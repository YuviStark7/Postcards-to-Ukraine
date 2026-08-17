/* ─────────────────────────────────────────────────────────────
   A letter to my friends in Ukraine — digital postcard
   ───────────────────────────────────────────────────────────── */
(() => {
'use strict';

const $  = s => document.querySelector(s);
const body = document.body;
const deck = $('#deck');
const envelope = $('#envelope');
const nextBtn = $('#next');
const backBtn = $('#back');
const pips = $('#pips');
const skipBtn = $('#skip');
const finale = $('#finale');

const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const TOUCH = matchMedia('(hover: none)').matches;

/* card order: 1 · 2 · 3 · 4 · photo(+chibi) · 6 */
const SEQ = [
  { kind:'text',  n:1 },
  { kind:'text',  n:2 },
  { kind:'text',  n:3 },
  { kind:'text',  n:4 },
  { kind:'photo'      },
  { kind:'text',  n:6 }
];

let LINES = null;
let cards = [];
let idx = 0;
let stage = 'loading';
let writer = null;

/* ══ sound ══════════════════════════════════════════════════ */
const Sfx = {
  on:false, ctx:null, noise:null, master:null,

  boot(){
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.9;
    this.master.connect(this.ctx.destination);
    const len = this.ctx.sampleRate * 2;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noise = buf;
  },

  _noiseSrc(rate = 1){
    const s = this.ctx.createBufferSource();
    s.buffer = this.noise; s.loop = true; s.playbackRate.value = rate;
    return s;
  },

  tear(){
    if (!this.on) return; this.boot(); if (!this.ctx) return;
    const t = this.ctx.currentTime, s = this._noiseSrc(1.1);
    const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.1;
    f.frequency.setValueAtTime(700, t);
    f.frequency.exponentialRampToValueAtTime(3200, t + 0.42);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.19, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.06, t + 0.26);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.62);
    s.connect(f).connect(g).connect(this.master);
    s.start(t); s.stop(t + 0.66);
  },

  slide(pitch = 1){
    if (!this.on) return; this.boot(); if (!this.ctx) return;
    const t = this.ctx.currentTime, s = this._noiseSrc(0.7 * pitch);
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass';
    f.frequency.setValueAtTime(2400, t);
    f.frequency.exponentialRampToValueAtTime(700, t + 0.3);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.11, t + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.34);
    s.connect(f).connect(g).connect(this.master);
    s.start(t); s.stop(t + 0.36);
  },

  scratch(dur){
    if (!this.on) return; this.boot(); if (!this.ctx) return;
    const t = this.ctx.currentTime, s = this._noiseSrc(1.4);
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = 2600; f.Q.value = 2.2;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.035, t + 0.02);
    /* flutter, so it reads as a nib rather than static */
    const lfo = this.ctx.createOscillator(), lg = this.ctx.createGain();
    lfo.frequency.value = 26 + Math.random() * 14; lg.gain.value = 0.018;
    lfo.connect(lg).connect(g.gain);
    g.gain.setValueAtTime(0.035, t + Math.max(0.03, dur - 0.05));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.05);
    s.connect(f).connect(g).connect(this.master);
    s.start(t); lfo.start(t);
    s.stop(t + dur + 0.08); lfo.stop(t + dur + 0.08);
  },

  pop(){
    if (!this.on) return; this.boot(); if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(430, t);
    o.frequency.exponentialRampToValueAtTime(190, t + 0.11);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.06, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    o.connect(g).connect(this.master); o.start(t); o.stop(t + 0.18);
    this.slide(1.5);
  },

  thud(){
    if (!this.on) return; this.boot(); if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(62, t + 0.2);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.16, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.34);
    o.connect(g).connect(this.master); o.start(t); o.stop(t + 0.36);
  },

  chime(){
    if (!this.on) return; this.boot(); if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [660, 990].forEach((hz, i) => {
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = 'triangle'; o.frequency.value = hz;
      const s = t + i * 0.11;
      g.gain.setValueAtTime(0.0001, s);
      g.gain.exponentialRampToValueAtTime(0.045, s + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, s + 0.9);
      o.connect(g).connect(this.master); o.start(s); o.stop(s + 0.95);
    });
  }
};

$('#sound').addEventListener('click', e => {
  const b = e.currentTarget;
  Sfx.on = !Sfx.on;
  b.setAttribute('aria-pressed', String(Sfx.on));
  b.setAttribute('aria-label', Sfx.on ? 'Turn sound off' : 'Turn sound on');
  if (Sfx.on){ Sfx.boot(); if (Sfx.ctx && Sfx.ctx.state === 'suspended') Sfx.ctx.resume(); Sfx.pop(); }
});

/* ══ stage helper ═══════════════════════════════════════════ */
function setStage(s){ stage = s; body.dataset.stage = s; }

/* ══ build cards ════════════════════════════════════════════ */
function buildTextCard(n){
  const el = document.createElement('article');
  el.className = 'card';
  el.innerHTML = `<div class="card-inner">
      <img class="sheet" src="images/c${n}-base.webp" alt="" draggable="false">
    </div>`;
  const inner = el.firstElementChild;

  const meta = LINES.lines[String(n)];
  const lineEls = meta.map(L => {
    const d = document.createElement('div');
    d.className = 'ln';
    d.style.left   = (L.x * 100) + '%';
    d.style.top    = (L.y * 100) + '%';
    d.style.width  = (L.w * 100) + '%';
    d.style.height = (L.h * 100) + '%';
    d.style.backgroundImage = `url(images/c${n}.webp)`;
    d.style.backgroundSize = `${100 / L.w}% ${100 / L.h}%`;
    d.style.backgroundPosition =
      `${100 * L.x / (1 - L.w)}% ${100 * L.y / (1 - L.h)}%`;
    inner.appendChild(d);
    return d;
  });

  const pen = document.createElement('div');
  pen.className = 'pen';
  pen.innerHTML = '<img src="images/vodka.webp" alt="" draggable="false">';
  inner.appendChild(pen);

  return { el, kind:'text', meta, lineEls, pen, written:false };
}

function buildPhotoCard(){
  const el = document.createElement('article');
  el.className = 'card is-photo';
  el.innerHTML = `<div class="card-inner">
      <div class="tilt">
        <img class="im-photo" src="images/photo.webp" alt="Four friends at a café table" draggable="false">
        <img class="im-chibi" src="images/chibi.webp" alt="The same photo, drawn as chibi characters" draggable="false">
        <div class="shine"></div><div class="holo"></div><div class="edge"></div>
      </div>
    </div>
    <p class="swap-hint sh-left"><b>←</b> ${TOUCH ? 'tap' : 'move'} left<br><span>the drawing</span></p>
    <p class="swap-hint sh-right">${TOUCH ? 'tap' : 'move'} right <b>→</b><br><span>the real one</span></p>`;
  const card = { el, kind:'photo', written:true };
  setupTilt(card);
  return card;
}

/* ══ tilt + chibi swap ══════════════════════════════════════ */
function setupTilt(card){
  const el = card.el;
  const tilt = el.querySelector('.tilt');
  let tx = 0, ty = 0, cx = 0, cy = 0, ts = 1, cs = 1, raf = 0, live = false;
  let sticky = false;                 /* touch: keep the side until next tap */

  const lerp = (a, b, k) => a + (b - a) * k;

  function loop(){
    cx = lerp(cx, tx, .12); cy = lerp(cy, ty, .12); cs = lerp(cs, ts, .12);
    tilt.style.setProperty('--rx', cy.toFixed(3) + 'deg');
    tilt.style.setProperty('--ry', cx.toFixed(3) + 'deg');
    tilt.style.setProperty('--ts', cs.toFixed(4));
    if (Math.abs(cx - tx) + Math.abs(cy - ty) + Math.abs(cs - ts) > 0.002)
      raf = requestAnimationFrame(loop);
    else raf = 0;
  }
  const kick = () => { if (!raf) raf = requestAnimationFrame(loop); };

  function at(e){
    const r = tilt.getBoundingClientRect();
    const nx = (e.clientX - r.left) / r.width;
    const ny = (e.clientY - r.top) / r.height;
    if (!REDUCED){
      tx = (nx - .5) * 17;
      ty = -(ny - .5) * 12;
      ts = 1.025;
    }
    tilt.style.setProperty('--px', (nx * 100).toFixed(1) + '%');
    tilt.style.setProperty('--py', (ny * 100).toFixed(1) + '%');
    tilt.style.setProperty('--pxn', nx.toFixed(3));
    tilt.style.setProperty('--shine', '1');
    const chibi = nx < 0.5;
    if (chibi !== el.classList.contains('chibi-on')){
      el.classList.toggle('chibi-on', chibi);
      Sfx.slide(chibi ? 1.25 : 1.05);
    }
    kick();
  }

  function rest(){
    tx = ty = 0; ts = 1;
    tilt.style.setProperty('--shine', '0');
    if (!sticky) el.classList.remove('chibi-on');
    kick();
  }

  tilt.addEventListener('pointerdown', e => {
    live = true;
    sticky = e.pointerType === 'touch';
    at(e);
    if (e.pointerType === 'touch') e.preventDefault();
  });
  tilt.addEventListener('pointermove', e => {
    if (e.pointerType === 'touch' && !live) return;
    at(e);
  });
  tilt.addEventListener('pointerup',     () => { live = false; if (!sticky) rest(); });
  tilt.addEventListener('pointercancel', () => { live = false; rest(); });
  tilt.addEventListener('pointerleave',  () => { live = false; rest(); });
}

/* ══ handwriting engine ═════════════════════════════════════ */
/* PACE is the one dial worth touching: higher = slower, calmer writing.
   1 is brisk, 2.5 is an unhurried hand. Everything below scales off it. */
const PACE = 2.5;
const SPEED    = 2500 / PACE;   /* px of ink per second on the native 1067px card */
const MIN_LINE = 300  * PACE;   /* even a short line should read as written */
const MAX_LINE = 620  * PACE;
const GAP      = 70   * Math.sqrt(PACE);   /* breath between lines */
const PARA     = 290  * Math.sqrt(PACE);   /* longer pause where he left a blank line */

function schedule(meta){
  const gaps = meta.map(m => m.gap).filter(g => g > 0).sort((a, b) => a - b);
  const median = gaps.length ? gaps[Math.floor(gaps.length / 2)] : 40;
  let t = 140, out = [];
  meta.forEach((L, i) => {
    if (i > 0) t += (L.gap > median * 1.7) ? PARA : GAP;
    const dur = Math.min(MAX_LINE, Math.max(MIN_LINE, (L.len / SPEED) * 1000));
    out.push({ start: t, dur });
    t += dur;
  });
  return { steps: out, total: t + 220 };
}

function stopWriting(){
  if (writer){ cancelAnimationFrame(writer.raf); writer = null; }
  skipBtn.classList.add('hide');
}

function finishCard(card){
  stopWriting();
  card.lineEls.forEach(d => { d.style.clipPath = 'inset(0 0 0 0)'; });
  card.pen.classList.remove('on');
  card.written = true;
  showNext(true);
}

function writeCard(card){
  stopWriting();
  if (REDUCED){ finishCard(card); return; }

  const { steps, total } = schedule(card.meta);
  card.lineEls.forEach(d => { d.style.clipPath = 'inset(0 100% 0 0)'; });
  card.pen.classList.remove('on');
  showNext(false);

  const t0 = performance.now();
  const fired = new Array(steps.length).fill(false);
  const w = { raf:0 };
  writer = w;

  (function frame(now){
    if (writer !== w) return;
    const t = now - t0;
    let active = -1;

    for (let i = 0; i < steps.length; i++){
      const s = steps[i];
      let p = (t - s.start) / s.dur;
      if (p <= 0) p = 0; else if (p >= 1) p = 1; else active = i;
      /* ease the very end so the nib settles */
      const e = p < 1 ? 1 - Math.pow(1 - p, 1.35) : 1;
      card.lineEls[i].style.clipPath = `inset(0 ${((1 - e) * 100).toFixed(2)}% 0 0)`;
      if (!fired[i] && t >= s.start){ fired[i] = true; Sfx.scratch(s.dur / 1000); }
    }

    if (active >= 0){
      const L = card.meta[active], s = steps[active];
      const p = Math.min(1, Math.max(0, (t - s.start) / s.dur));
      const e = 1 - Math.pow(1 - p, 1.35);
      card.pen.classList.add('on');
      card.pen.style.left = ((L.x + L.w * e) * 100).toFixed(2) + '%';
      card.pen.style.top  = ((L.y + L.h * 0.84) * 100).toFixed(2) + '%';
    } else {
      card.pen.classList.remove('on');
    }

    if (t < total) w.raf = requestAnimationFrame(frame);
    else { writer = null; card.written = true; card.pen.classList.remove('on'); showNext(true); }
  })(t0);
}

/* ══ deck state ═════════════════════════════════════════════ */
function envTransform(i){
  const e = envelope.getBoundingClientRect();
  const d = deck.getBoundingClientRect();
  if (!e.width || !d.width) return 'translate3d(0,120px,-300px) scale(.3)';
  const dx = (e.left + e.width / 2) - (d.left + d.width / 2);
  const dy = (e.top + e.height * 0.66) - (d.top + d.height / 2);
  const s  = (e.width * 0.8) / d.width;
  const rot = -7 + i * 2.6;
  return `translate3d(${dx.toFixed(1)}px, ${dy.toFixed(1)}px, -140px) scale(${s.toFixed(4)}) rotate(${rot}deg)`;
}

function setEnvVars(){
  cards.forEach((c, i) => c.el.style.setProperty('--tf-env', envTransform(i)));
}

function render(){
  cards.forEach((c, i) => {
    const cl = c.el.classList;
    cl.remove('st-in-envelope', 'st-behind', 'st-active', 'st-past', 'st-deep');
    const d = i - idx;
    if (d < 0){ cl.add('st-past'); c.el.style.zIndex = 70 + i; }
    else if (d === 0){ cl.add('st-active'); c.el.style.zIndex = 60; }
    else if (d <= 3){ c.el.style.setProperty('--i', d); cl.add('st-behind'); c.el.style.zIndex = 50 - d; }
    else { cl.add('st-deep'); c.el.style.zIndex = 40; }
  });
  pips.querySelectorAll('i').forEach((p, i) => {
    p.classList.toggle('on', i === idx);
    p.classList.toggle('seen', i < idx);
  });
  backBtn.classList.toggle('hide', idx === 0);
}

function showNext(show){
  const last = idx === cards.length - 1;
  nextBtn.classList.toggle('hide', !show || last);
  skipBtn.classList.toggle('hide', show);
  if (show && last && stage === 'cards') openFinale();
}

function goTo(i, dir){
  if (i < 0 || i >= cards.length || i === idx) return;
  stopWriting();
  closeFinale();
  idx = i;
  render();
  Sfx.pop();
  const card = cards[idx];
  if (card.kind === 'photo'){ showNext(true); return; }
  if (card.written || dir < 0){
    card.lineEls.forEach(d => { d.style.clipPath = 'inset(0 0 0 0)'; });
    card.written = true;
    showNext(true);
  } else {
    setTimeout(() => { if (cards[idx] === card && stage === 'cards') writeCard(card); }, 340);
  }
}

/* ══ finale ═════════════════════════════════════════════════ */
let finaleOn = false;
function openFinale(){
  if (finaleOn) return;
  finaleOn = true;
  setTimeout(() => {
    if (!finaleOn) return;
    finale.hidden = false;
    body.classList.add('finale-on');
  }, 900);
}
function closeFinale(){
  finaleOn = false; finale.hidden = true; body.classList.remove('finale-on');
}

function putBack(){
  if (stage !== 'cards') return;
  closeFinale();
  stopWriting();
  setStage('gather');
  setEnvVars();

  /* 1 — everything comes back into one stack */
  cards.forEach((c, i) => {
    c.el.classList.remove('st-past', 'st-active', 'st-deep', 'st-behind');
    c.el.style.setProperty('--i', i);
    c.el.style.zIndex = 60 - i;
    c.el.style.transitionDelay = (i * 45) + 'ms';
    c.el.classList.add('st-behind');
  });
  Sfx.slide(0.9);

  /* 2 — the stack slips into the envelope, front card leading */
  const STEP = 65, GO = 620;
  setTimeout(() => {
    cards.forEach((c, i) => {
      c.el.style.transitionDelay = (i * STEP) + 'ms';
      c.el.classList.remove('st-behind');
      c.el.classList.add('st-in-envelope');
      setTimeout(() => Sfx.slide(1 + i * 0.06), i * STEP);
    });
  }, GO);

  /* 3 — flap closes */
  const IN_BY = GO + (cards.length - 1) * STEP + 800;
  setTimeout(() => { setStage('closing'); Sfx.thud(); }, IN_BY - 120);

  /* 4 — tuck everything back to the start so the journey can run again */
  setTimeout(() => {
    cards.forEach(c => {
      c.el.style.transitionDelay = '';
      c.el.classList.remove('st-in-envelope', 'st-behind', 'st-active', 'st-past', 'st-deep', 'chibi-on');
      if (c.kind === 'text'){
        c.written = false;
        c.lineEls.forEach(d => { d.style.clipPath = 'inset(0 100% 0 0)'; });
        c.pen.classList.remove('on');
      }
    });
    idx = 0;
    pips.querySelectorAll('i').forEach((p, i) => {
      p.classList.toggle('on', i === 0); p.classList.remove('seen');
    });
    backBtn.classList.add('hide');
    nextBtn.classList.remove('hide');
    skipBtn.classList.add('hide');
    setStage('envelope');
  }, IN_BY + 640);
}

/* ══ open the envelope ══════════════════════════════════════ */
function openEnvelope(){
  if (stage !== 'envelope') return;
  body.classList.remove('first');
  setStage('opening');
  Sfx.tear();
  setEnvVars();
  cards.forEach(c => { c.el.style.transition = 'none'; c.el.classList.add('st-in-envelope'); });
  void deck.offsetWidth;
  cards.forEach(c => { c.el.style.transition = ''; });

  setTimeout(() => {
    setStage('cards');
    idx = 0;
    cards.forEach((c, i) => { c.el.style.transitionDelay = (i * 70) + 'ms'; });
    render();
    Sfx.slide(0.95);
    setTimeout(() => cards.forEach(c => { c.el.style.transitionDelay = ''; }), 700);
    setTimeout(() => { if (stage === 'cards') writeCard(cards[0]); }, 780);
  }, 430);
}

/* ══ greeting ═══════════════════════════════════════════════ */
function playGreeting(ready){
  setStage('greeting');
  const ink = $('#hello .hello-ink');
  const sub = $('#helloSub');
  Sfx.chime();

  const dur = REDUCED ? 1 : 1150;
  const t0 = performance.now();
  (function frame(now){
    const p = Math.min(1, (now - t0) / dur);
    const e = 1 - Math.pow(1 - p, 1.5);
    ink.style.clipPath = `inset(0 ${((1 - e) * 100).toFixed(2)}% -30% 0)`;
    if (p < 1) requestAnimationFrame(frame);
    else {
      sub.classList.add('on');
      ready.then(() => setTimeout(toEnvelope, REDUCED ? 200 : 1000));
    }
  })(t0);
}

function toEnvelope(){
  if (stage !== 'greeting') return;
  setStage('greeting-out');
  setTimeout(() => {
    if (needRotate()){ $('#rotate').hidden = false; }
    setStage('envelope');
    setEnvVars();
  }, 520);
}

/* ══ rotate nudge ═══════════════════════════════════════════ */
let rotateDismissed = false;
function needRotate(){
  return !rotateDismissed && innerWidth < 720 && innerHeight > innerWidth;
}
$('#rotateSkip').addEventListener('click', () => {
  rotateDismissed = true; $('#rotate').hidden = true;
});
addEventListener('resize', () => {
  if (!needRotate()) $('#rotate').hidden = true;
  else if (stage !== 'loading' && stage !== 'greeting') $('#rotate').hidden = false;
  setEnvVars();
});

/* ══ input ══════════════════════════════════════════════════ */
envelope.addEventListener('click', openEnvelope);
nextBtn.addEventListener('click', () => goTo(idx + 1, 1));
backBtn.addEventListener('click', () => goTo(idx - 1, -1));
skipBtn.addEventListener('click', () => { if (writer) finishCard(cards[idx]); });
finale.addEventListener('click', putBack);

deck.addEventListener('click', e => {
  if (stage !== 'cards') return;
  const card = cards[idx];
  if (card.kind === 'text' && writer){ finishCard(card); e.stopPropagation(); }
});

addEventListener('keydown', e => {
  if (e.key === 'ArrowRight' || e.key === 'PageDown'){
    if (stage === 'cards'){ writer ? finishCard(cards[idx]) : goTo(idx + 1, 1); }
  } else if (e.key === 'ArrowLeft' || e.key === 'PageUp'){
    if (stage === 'cards') goTo(idx - 1, -1);
  } else if (e.key === 'Enter' || e.key === ' '){
    if (stage === 'envelope'){ openEnvelope(); e.preventDefault(); }
    else if (stage === 'cards' && finaleOn){ putBack(); e.preventDefault(); }
  } else if (e.key === 'Escape'){
    if (stage === 'cards') putBack();
  }
});

/* ══ boot ═══════════════════════════════════════════════════ */
function preload(list){
  return Promise.all(list.map(src => new Promise(res => {
    const im = new Image();
    im.onload = im.onerror = res;
    im.src = src;
  })));
}

function init(){
  body.classList.add('first');

  LINES = window.__LINES;
  if (!LINES){
    console.error('data.js did not load');
    document.getElementById('helloSub').textContent = 'hmm — data.js did not load';
    return;
  }

  cards = SEQ.map(s => s.kind === 'photo' ? buildPhotoCard() : buildTextCard(s.n));
  cards.forEach(c => deck.appendChild(c.el));
  pips.innerHTML = cards.map((_, i) => `<i class="${i ? '' : 'on'}"></i>`).join('');
  /* cards stay tucked away (the default .card state is invisible) until the
     envelope is opened — render() is only ever called from the card stages */

  const assets = [];
  SEQ.forEach(s => { if (s.kind === 'text') assets.push(`images/c${s.n}.webp`, `images/c${s.n}-base.webp`); });
  assets.push('images/photo.webp', 'images/chibi.webp', 'images/ornament.webp', 'images/vodka.webp');

  const ready = Promise.race([
    preload(assets),
    new Promise(r => setTimeout(r, 8000))
  ]);

  /* fonts first so "Привіт" is never drawn twice */
  const fonts = document.fonts ? document.fonts.ready : Promise.resolve();
  Promise.race([fonts, new Promise(r => setTimeout(r, 2500))])
    .then(() => playGreeting(ready));
}

if (document.readyState === 'loading') addEventListener('DOMContentLoaded', init);
else init();

})();
