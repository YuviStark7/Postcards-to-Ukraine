import numpy as np, cv2, json
from PIL import Image, ImageFilter

import os
# folder holding the original "DASHA LETTER n.png" files (defaults to alongside this script)
SRC=os.environ.get('DASHA_SRC', os.path.dirname(os.path.abspath(__file__)))
OUT='images'
os.makedirs(OUT, exist_ok=True)
OLIVE=np.array([172,165,120]); PAPER=np.array([220,197,117])
REGION={1:(180,250,700,560), 2:(20,70,1050,680), 3:(20,70,1050,720), 4:(20,70,1050,720), 6:(170,330,700,450)}

def load(n): return np.array(Image.open(f'{SRC}/DASHA LETTER {n}.png').convert('RGB'))
def inkmask(im):
    a=im.astype(np.int16); return (a[...,2]-a[...,0]>40)&(a[...,0]<180)

def deckle_alpha(im):
    """transparent where the olive matte is, feathered. no matte -> fully opaque."""
    if np.linalg.norm(im[0,0].astype(np.float32)-OLIVE)>30:
        return np.full(im.shape[:2],255,np.uint8)
    d=np.linalg.norm(im.astype(np.float32)-OLIVE,axis=2)
    olive=(d<30).astype(np.uint8)
    # every olive blob that touches ANY image border is outside the paper.
    # (a single flood from one corner misses wedges the ornament cuts off)
    n,lbl=cv2.connectedComponents(olive,connectivity=8)
    edge=np.unique(np.concatenate([lbl[0,:],lbl[-1,:],lbl[:,0],lbl[:,-1]]))
    edge=edge[edge!=0]
    outer=np.isin(lbl,edge).astype(np.uint8)
    outer=cv2.dilate(outer,np.ones((3,3),np.uint8),1)      # eat 1px of fringe
    a=(1.0-outer.astype(np.float32))*255
    a=cv2.GaussianBlur(a,(0,0),0.9)
    return close_deckle(np.clip(a,0,255).astype(np.uint8))

def _repair(prof, valid, rng):
    """Fill the stretches where the torn border is missing with a matching
    wobble, anchored to the real edge on either side."""
    n=len(prof)
    if valid.sum() < n*0.25: return prof.astype(np.float32)
    idx=np.arange(n)
    base=np.interp(idx, idx[valid], prof[valid].astype(np.float32))
    amp=float(np.clip(prof[valid].std(), 2.5, 7.0))
    k=np.exp(-0.5*(np.arange(-12,13)/4.0)**2); k/=k.sum()
    noise=np.convolve(rng.normal(0,1,n), k, mode='same')
    noise/= (noise.std()+1e-6)
    mk=np.exp(-0.5*(np.arange(-8,9)/3.0)**2); mk/=mk.sum()
    m=np.convolve((~valid).astype(np.float32), mk, mode='same')
    m=np.clip(m*1.5-0.2, 0, 1)
    return base + noise*amp*m

def close_deckle(alpha):
    A=alpha>127; H,W=A.shape
    rng=np.random.default_rng(11)
    xs=np.arange(W)[None,:]; ys=np.arange(H)[:,None]

    def profile(axis, last):
        out=np.full(A.shape[axis], -1.0)
        for i in range(A.shape[axis]):
            line=A[i] if axis==0 else A[:,i]
            w=np.where(line)[0]
            if len(w): out[i]= w.max() if last else w.min()
        return out

    def side(axis, last, limit):
        p=profile(axis, last)
        v=(p>=0)&((p<limit-1) if last else (p>0))
        return _repair(p, v, rng)

    right = side(0, True,  W)[:,None]
    left  = side(0, False, W)[:,None]
    bottom= side(1, True,  H)[None,:]
    top   = side(1, False, H)[None,:]

    m = (np.clip(right - xs + .5, 0, 1) * np.clip(xs - left + .5, 0, 1) *
         np.clip(bottom - ys + .5, 0, 1) * np.clip(ys - top + .5, 0, 1))
    return (alpha.astype(np.float32) * m).astype(np.uint8)

def save(rgb,alpha,path,q=92):
    Image.fromarray(np.dstack([rgb,alpha])).save(path,quality=q,method=6)

def runs_of(f):
    o=[];s=None
    for i,v in enumerate(f):
        if v and s is None: s=i
        if not v and s is not None: o.append([s,i-1]);s=None
    if s is not None: o.append([s,len(f)-1])
    return o

meta={}
for n in (1,2,3,4,6):
    im=load(n); H,W=im.shape[:2]
    alpha=deckle_alpha(im)
    ink=inkmask(im)
    x0,y0,x1,y1=REGION[n]
    reg=np.zeros_like(ink); reg[y0:y1,x0:x1]=True
    tink=ink&reg

    bands=runs_of(tink.sum(1)>2); merged=[]
    for b in bands:
        if merged and b[0]-merged[-1][1]<=6: merged[-1][1]=b[1]
        else: merged.append(b)
    bands=[b for b in merged if tink[b[0]:b[1]+1].sum()>50]

    lines=[]; prev=None
    for a,b in bands:
        seg=tink[a:b+1]; cx=np.where(seg.any(0))[0]
        pa,pb=max(0,a-9),min(H-1,b+9); ca,cb=max(0,cx.min()-11),min(W-1,cx.max()+13)
        gap = 0 if prev is None else a-prev
        prev=b
        lines.append({'x':round(ca/W,5),'y':round(pa/H,5),'w':round((cb-ca+1)/W,5),
                      'h':round((pb-pa+1)/H,5),'len':int(cx.max()-cx.min()+1),'gap':int(gap)})
    meta[n]=lines
    print(f'card {n}: {len(lines)} lines')

    # blank-paper base: inpaint, then smooth the patched area to kill streaks, re-add grain
    m=cv2.dilate((tink*255).astype(np.uint8),np.ones((7,7),np.uint8),2)
    base=cv2.inpaint(cv2.cvtColor(im,cv2.COLOR_RGB2BGR),m,6,cv2.INPAINT_TELEA)
    base=cv2.cvtColor(base,cv2.COLOR_BGR2RGB).astype(np.float32)
    soft=cv2.GaussianBlur(base,(0,0),9)
    w8=cv2.GaussianBlur((m>0).astype(np.float32),(0,0),4)[...,None]
    base=base*(1-w8)+soft*w8
    rng=np.random.default_rng(7)
    base=np.clip(base+rng.normal(0,1.6,base.shape)*w8,0,255).astype(np.uint8)
    save(base,alpha,f'{OUT}/c{n}-base.webp')
    save(im,alpha,f'{OUT}/c{n}.webp')

for n,name,q in ((5,'photo',86),(7,'chibi',86)):
    im=load(n); save(im,deckle_alpha(im),f'{OUT}/{name}.webp',q)

# corner ornament (from card 6, bottom-right) with alpha, for the envelope
im=load(6); crop=im[372:806, 620:1067]
d=np.linalg.norm(crop.astype(np.float32)-PAPER,axis=2)
a=np.clip((d-18)/40,0,1)
a=cv2.GaussianBlur(a,(0,0),0.6)
rgb=PAPER+(crop.astype(np.float32)-PAPER)/np.clip(a,0.3,1)[...,None]
save(np.clip(rgb,0,255).astype(np.uint8),(a*255).astype(np.uint8),f'{OUT}/ornament.webp',95)

D={'w':1067,'h':806,'lines':{str(k):v for k,v in meta.items()}}
json.dump(D,open(f'{OUT}/lines.json','w'))
open('data.js','w').write('/* generated by prep.py — text-line geometry for the handwriting reveal */\nwindow.__LINES = '+json.dumps(D,separators=(',',':'))+';\n')
print('done')
