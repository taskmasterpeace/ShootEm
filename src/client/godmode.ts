// ---------------------------------------------------------------------------
// GOD MODE (testing harness, Robert: "I should be able to change into any LSW
// at any time"). Backtick toggles a panel listing every living super weapon
// with its signature and cooldown — click one and you WEAR it, instantly, with
// no faction / one-per-team / no-humans-on-fliers rule in the way. You're also
// untouchable while it's on, because the point is to stand in the open and
// watch the AI actually work.
//
// Pure client debug surface: it only calls world.godMorph, so the sim stays
// deterministic and nothing here ships into a real match unless you open it.
// ---------------------------------------------------------------------------
import { LSWS, THREAT } from '../sim/lsw';
import type { AscendantId, Soldier } from '../sim/types';
import type { World } from '../sim/world';

const FACTION_NAME = ['UNITED FRONT', 'THE COLLECTIVE'];

export function initGodMode(getWorld: () => World | null, getMe: () => Soldier | null): void {
  const panel = document.createElement('div');
  panel.id = 'godmode';
  panel.style.cssText = [
    'position:fixed', 'inset:5vh 6vw', 'z-index:9999', 'display:none',
    'background:rgba(16,17,20,0.96)', 'border:1px solid #3a3f4a', 'border-radius:10px',
    'color:#e7ecf2', 'font:13px Inter,system-ui,sans-serif', 'overflow:auto', 'padding:14px 18px',
    'backdrop-filter:blur(6px)',
  ].join(';');
  document.body.appendChild(panel);

  let open = false;

  const row = (id: AscendantId) => {
    const d = LSWS[id];
    const hp = THREAT[d.threat].hp;
    const tags = [
      `T${d.threat}`, `${hp}hp`,
      d.flies ? 'FLIER' : '', d.moves === 'leap' ? 'LEAP' : d.moves === 'blinkwalk' ? 'BLINK' : '',
    ].filter(Boolean).join(' · ');
    return `<button class="god-pick" data-id="${id}" style="
        display:block;width:100%;text-align:left;margin:0 0 5px;padding:7px 9px;cursor:pointer;
        background:#1b1f26;border:1px solid #2f3540;border-radius:7px;color:#e7ecf2;font:inherit">
      <span style="color:#e8a33d;font-weight:600">${d.name}</span>
      <span style="color:#8b96a5;font-size:11px"> ${tags}</span><br>
      <span style="color:#b9c2cf;font-size:11.5px">Q · ${d.activeLabel} <span style="color:#7f8a99">(${d.activeCd}s)</span></span>
    </button>`;
  };

  const render = () => {
    const ids = Object.keys(LSWS) as AscendantId[];
    const col = (team: 0 | 1) => `
      <div style="flex:1;min-width:300px">
        <div style="color:#8b96a5;font-size:11px;letter-spacing:.08em;margin:0 0 7px">${FACTION_NAME[team]}</div>
        ${ids.filter((i) => LSWS[i].faction === team).map(row).join('')}
      </div>`;
    panel.innerHTML = `
      <div style="display:flex;align-items:baseline;gap:12px;margin-bottom:10px">
        <b style="font-size:16px">GOD MODE</b>
        <span style="color:#8b96a5;font-size:11.5px">click a god to wear it · you are untouchable · <b>\`</b> closes</span>
        <button id="god-off" style="margin-left:auto;padding:6px 12px;cursor:pointer;background:#33291b;
          border:1px solid #e8a33d;border-radius:6px;color:#e8a33d;font:inherit;font-weight:600">BACK TO TROOPER</button>
      </div>
      <div style="display:flex;gap:22px;align-items:flex-start">${col(0)}${col(1)}</div>`;

    panel.querySelector('#god-off')?.addEventListener('click', () => {
      const w = getWorld(), me = getMe();
      if (w && me) w.godMorph(me, null);
      hide();
    });
    for (const b of Array.from(panel.querySelectorAll<HTMLElement>('.god-pick'))) {
      b.addEventListener('click', () => {
        const w = getWorld(), me = getMe();
        if (w && me) w.godMorph(me, b.dataset.id as AscendantId);
        hide();
      });
    }
  };

  const hide = () => { open = false; panel.style.display = 'none'; document.exitPointerLock?.(); };
  const show = () => { open = true; render(); panel.style.display = 'block'; document.exitPointerLock?.(); };

  window.addEventListener('keydown', (e) => {
    if (e.code !== 'Backquote') return;
    if (!getWorld() || !getMe()) return; // only inside a live match
    e.preventDefault();
    e.stopPropagation();
    if (open) hide(); else show();
  }, true); // capture: beat the game's own input handler to the key
}
