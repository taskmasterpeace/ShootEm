// ---------------------------------------------------------------------------
// THE STABLE — the officer's V channel (finish-list #3/#4/#5, §6-§7).
// One console, two wires: singleplayer calls the sim directly, multiplayer
// sends {t:'lsw'} and lets the server's requestLsw be the judge. The
// commission is EARNED BY RECORD (D2): the OCS path — offered only after
// three real matches — or a Lieutenant's worth of rank points. Draftees
// and the enlisted see the roster; only officers get a dial tone.
// ---------------------------------------------------------------------------
import { WEAPONS } from '../sim/data';
import { LSWS, THREAT, lswAllowed, lswsForTeam } from '../sim/lsw';
import type { AscendantId, ModeId, Team } from '../sim/types';
import { loadOnboarding } from './onboarding';
import type { Dossier } from './record';

/** D2: officers are earned by record, never bought. */
export function isCommissioned(dossier: Dossier | null): boolean {
  if (loadOnboarding().path === 'ocs') return true; // the split comes AFTER three real drops
  return (dossier?.soldier.rankPoints ?? 0) >= 8000; // the Lieutenant line
}

export interface StableWires {
  mode: ModeId;
  commissioned: boolean;
  team: () => Team;
  /** place the call; false = the net refused (slot taken, purse empty…) */
  call: (id: AscendantId) => boolean;
  /** the faction purse; negative = unknown (MP client — the server knows) */
  stock: () => number;
  /** the HUD line on a successful call */
  announce?: (text: string) => void;
}

export class StableConsole {
  private el: HTMLDivElement;
  private open = false;
  private onKey = (e: KeyboardEvent) => {
    if (e.code === 'KeyV' && !e.repeat) { this.toggle(); e.preventDefault(); }
    else if (this.open && e.code === 'Escape') { this.hide(); e.preventDefault(); }
  };

  constructor(private w: StableWires) {
    this.el = document.createElement('div');
    this.el.id = 'stable-console';
    this.el.style.cssText = [
      'position:fixed', 'left:50%', 'top:50%', 'transform:translate(-50%,-50%)',
      'min-width:340px', 'max-height:70vh', 'overflow-y:auto', 'z-index:60',
      'background:rgba(12,14,10,0.94)', 'border:1px solid #f5b21a', 'padding:14px 16px',
      "font-family:'Courier New',monospace", 'font-size:13px', 'color:#e8e0c8',
      'letter-spacing:0.04em', 'display:none',
    ].join(';');
    document.body.appendChild(this.el);
    window.addEventListener('keydown', this.onKey);
  }

  private render() {
    const team = this.w.team();
    const stock = this.w.stock();
    const stockLine = stock >= 0 ? `MATERIEL: ${stock}` : 'MATERIEL: COMMAND HOLDS THE LEDGER';
    if (!lswAllowed(this.w.mode)) {
      this.el.innerHTML = `<b style="color:#f5b21a">▌THE STABLE</b><br><br>The yard stays the yard — no war machines in this mode.<br><br><span style="opacity:0.6">[V] close</span>`;
      return;
    }
    if (!this.w.commissioned) {
      this.el.innerHTML = `<b style="color:#f5b21a">▌THE STABLE — CHANNEL LOCKED</b><br><br>` +
        `The V channel belongs to OFFICERS.<br>The commission is earned by record (§7):<br>` +
        `&nbsp;· the OCS path at the three-match review, or<br>&nbsp;· a Lieutenant's rank (8000 points).<br><br>` +
        `<span style="opacity:0.6">[V] close</span>`;
      return;
    }
    const rows = lswsForTeam(team).map((id) => {
      const def = LSWS[id];
      const price = THREAT[def.threat].materiel;
      const afford = stock < 0 || stock >= price;
      return `<div class="st-row" data-id="${id}" style="display:flex;justify-content:space-between;gap:12px;padding:2px 4px;cursor:${afford ? 'pointer' : 'default'};opacity:${afford ? 1 : 0.4}">` +
        `<span>${def.name.toUpperCase()} <span style="opacity:0.55">· ${WEAPONS[def.weapon]?.name ?? ''}</span></span><span>T${def.threat} · ${price}◈</span></div>`;
    }).join('');
    this.el.innerHTML = `<b style="color:#f5b21a">▌THE STABLE — ${stockLine}</b>` +
      `<div style="opacity:0.6;margin:4px 0 8px">You mark the LZ where you stand. Hold it for the countdown; the pod is yours.</div>` +
      rows + `<div style="opacity:0.6;margin-top:8px">[V] close · click a name to make the call</div>`;
    for (const row of this.el.querySelectorAll<HTMLDivElement>('.st-row')) {
      row.onclick = () => {
        const id = row.dataset.id as AscendantId;
        if (this.w.call(id)) {
          this.w.announce?.(`${LSWS[id].name.toUpperCase()} CALLED — HOLD THE MARK, THE POD IS YOURS`);
          this.hide();
        } else { row.style.color = '#ff3b3b'; setTimeout(() => { row.style.color = ''; }, 400); }
      };
    }
  }

  toggle() { if (this.open) this.hide(); else this.show(); }
  show() { this.open = true; this.render(); this.el.style.display = 'block'; }
  hide() { this.open = false; this.el.style.display = 'none'; }
  dispose() { window.removeEventListener('keydown', this.onKey); this.el.remove(); }
}
