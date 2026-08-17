# A letter to my friends in Ukraine

A digital postcard. It opens with a Ukrainian hello, an envelope pops up, and
the letters write themselves out one line at a time. The photo card swaps
between the real photo and the chibi drawing depending on which side you hover.
At the end the cards fly back into the envelope and you can start over.

Plain HTML, CSS and JavaScript — no build step, no dependencies, no tracking.
Drop the folder into a repo, turn on GitHub Pages, send the link.

## Files

| | |
|---|---|
| `index.html` | the page |
| `style.css` | all styling and animation |
| `app.js` | the sequence, the handwriting engine, the tilt card, the sound |
| `data.js` | generated — where each line of text sits on each card |
| `images/` | the postcards (cut out with their torn edges) and the bottle |
| `Vodka.png` | the original bottle art `prep.py` cuts out |
| `fonts/` | Caveat + Quicksand, self-hosted so nothing loads from a CDN |
| `prep.py` | how `images/` and `data.js` were made from the original PNGs |

## Changing things

**The order of the cards** — `SEQ` at the top of `app.js`.

**How fast the handwriting goes** — `PACE` at the top of `app.js`. Higher is
slower; everything else (line duration, the pauses between lines) scales off
it. `2.5` is an unhurried hand, `1` is brisk.

**The vodka bottle that does the writing** — `.pen` in `style.css`: `width`
sets its size relative to the card, the `rotate()` sets the lean.

**The greeting** — the `<h1>` in `index.html`.

**Adding or re-exporting a card** — put the new PNG in the folder `prep.py`
points at and run `python3 prep.py`. It finds the text lines automatically,
paints them out to make a blank version of the paper, and cuts the torn edge.

## Controls

Arrow keys or the buttons to move, click the card (or `skip`) to finish the
writing early, `Esc` to put everything back. Sound is off until you press the
speaker in the corner.
