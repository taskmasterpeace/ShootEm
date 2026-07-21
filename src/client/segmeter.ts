// ---------------------------------------------------------------------------
// THE SEGMENTED METER (UX-LANGUAGE §8 — DECIDED: shape A, amber lead-notch
// accent). ONE fill grammar for the whole game: notches fill left→right, the
// top band brightens toward MAXIMUM, overcharge flares the last notch red,
// and a 2px amber hairline rides the leading edge of the filling segment —
// the eye's anchor (the stamina bar's shipped edge treatment, promoted to
// law). Robert 2026-07-21: this is the only meter shape the game speaks.
// ---------------------------------------------------------------------------

export type SegState = 'active' | 'max' | 'over' | 'ready';

const N = 14;          // notches — enough resolution to read, few enough to count
const MAX_BAND = 10;   // segments from here up brighten (the 71%+ band)

export class SegMeter {
  readonly el: HTMLElement;
  private segs: HTMLElement[] = [];
  private notch: HTMLElement;
  private lastKey = '';

  constructor(host: HTMLElement) {
    this.el = host;
    host.classList.add('segmeter');
    for (let i = 0; i < N; i++) {
      const s = document.createElement('i');
      host.appendChild(s);
      this.segs.push(s);
    }
    this.notch = document.createElement('b'); // the lead-notch accent
    host.appendChild(this.notch);
  }

  /** Paint `frac` (0..1; >1 reads as overcharge) in `state`. Cheap: DOM only
   *  touches when the quantized picture actually changes. */
  set(frac: number, state: SegState = 'active') {
    const f = Math.max(0, Math.min(1.12, frac));
    const filled = Math.min(N, Math.floor(f * N + 1e-6));
    const key = `${filled}|${state}|${Math.round(f * 100)}`;
    if (key === this.lastKey) return;
    this.lastKey = key;
    const over = state === 'over' || f > 1;
    for (let i = 0; i < N; i++) {
      const on = i < filled;
      this.segs[i].className = !on ? ''
        : over && i === N - 1 ? 'over'
        : state === 'ready' ? 'ready'
        : (state === 'max' || i >= MAX_BAND) ? 'hot'
        : 'on';
    }
    // the lead-notch rides the exact fill edge — continuous truth on a
    // quantized row (and the ONE full-brightness accent this bar wears)
    this.notch.style.left = `${Math.min(f, 1) * 100}%`;
    this.notch.className = over ? 'over' : '';
  }

  show(on: boolean) { this.el.classList.toggle('hidden', !on); }
}
