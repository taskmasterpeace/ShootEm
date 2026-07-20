// ---------------------------------------------------------------------------
// GOD MODE (testing harness, Robert: "I should be able to change into any LSW
// at any time" → "I also want to improve God mode"). Backtick toggles a panel
// listing every living super weapon — click one and you WEAR it, instantly,
// with no faction / one-per-team / no-humans-on-fliers rule in the way.
// You're untouchable while it's on, because the point is to stand in the open
// and watch the AI actually work.
//
// The bench tools (v2): a search box that filters as you type, SHIFT-click to
// spawn any god as a live BOT on its own faction (your sparring partner),
// heal, cooldown reset, a NO-COOLDOWNS toggle for ability spam-testing, and a
// weather dial — fog is a perception feature now, so the tester gets a sky
// switch instead of waiting for the front to roll in.
//
// Pure client debug surface: it calls world.godMorph / addLsw / damageSoldier
// — the same doors the sim already exposes — so the sim stays deterministic
// and nothing here ships into a real match unless you open it.
// ---------------------------------------------------------------------------
import { LSWS, THREAT } from '../sim/lsw';
import type { AscendantId, Soldier } from '../sim/types';
import type { WeatherKind } from '../sim/weather';
import type { World } from '../sim/world';

const FACTION_NAME = ['UNITED FRONT', 'THE COLLECTIVE'];
const SKIES: WeatherKind[] = ['clear', 'rain', 'storm', 'fog', 'snow', 'dust', 'night'];

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
  let filter = '';
  let noCd = false;
  let note = '';

  // NO-COOLDOWNS: while armed, the bench zeroes your gates every few ticks —
  // Q, class ability, grenade. State-writing like the tests do; the sim's own
  // rules stay untouched for everyone else on the field.
  setInterval(() => {
    if (!noCd) return;
    const w = getWorld(), me = getMe();
    if (!w || !me || !me.god) return;
    me.nextLswActiveAt = 0;
    me.nextAbilityAt = 0;
    me.nextGrenadeAt = 0;
  }, 300);

  const btn = (id: string, label: string, on = false) => `<button id="${id}" style="
      padding:6px 11px;cursor:pointer;border-radius:6px;font:inherit;font-weight:600;
      background:${on ? '#33291b' : '#1b1f26'};border:1px solid ${on ? '#e8a33d' : '#2f3540'};
      color:${on ? '#e8a33d' : '#b9c2cf'}">${label}</button>`;

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
    const w = getWorld();
    const q = filter.trim().toLowerCase();
    const ids = (Object.keys(LSWS) as AscendantId[]).filter((i) => {
      if (!q) return true;
      const d = LSWS[i];
      return `${d.name} ${d.activeLabel} T${d.threat}`.toLowerCase().includes(q);
    });
    const col = (team: 0 | 1) => `
      <div style="flex:1;min-width:300px">
        <div style="color:#8b96a5;font-size:11px;letter-spacing:.08em;margin:0 0 7px">${FACTION_NAME[team]}</div>
        ${ids.filter((i) => LSWS[i].faction === team).map(row).join('') || '<div style="color:#5c6675;font-size:11.5px">no match</div>'}
      </div>`;
    panel.innerHTML = `
      <div style="display:flex;align-items:baseline;gap:12px;margin-bottom:8px">
        <b style="font-size:16px">GOD MODE</b>
        <span style="color:#8b96a5;font-size:11.5px">click = wear it · <b>SHIFT-click</b> = spawn it live as a bot · you are untouchable · <b>\`</b> closes</span>
        <button id="god-off" style="margin-left:auto;padding:6px 12px;cursor:pointer;background:#33291b;
          border:1px solid #e8a33d;border-radius:6px;color:#e8a33d;font:inherit;font-weight:600">BACK TO TROOPER</button>
      </div>
      <div style="display:flex;gap:7px;align-items:center;flex-wrap:wrap;margin-bottom:10px">
        <input id="god-search" placeholder="filter gods…" value="${filter.replace(/"/g, '&quot;')}" style="
          flex:0 1 220px;padding:6px 9px;background:#12151a;border:1px solid #2f3540;border-radius:6px;
          color:#e7ecf2;font:inherit;outline:none">
        ${btn('god-heal', 'FULL HEAL')}
        ${btn('god-cd', 'RESET CD')}
        ${btn('god-nocd', noCd ? 'NO COOLDOWNS: ON' : 'NO COOLDOWNS: OFF', noCd)}
        ${btn('god-sky', `SKY: ${w ? w.weather.kind.toUpperCase() : '—'}`)}
        ${btn('god-cull', 'KILL ENEMY GOD')}
        <span id="god-note" style="color:#e8a33d;font-size:11.5px">${note}</span>
      </div>
      <div style="display:flex;gap:22px;align-items:flex-start">${col(0)}${col(1)}</div>`;

    const say = (t: string) => { note = t; const el = panel.querySelector('#god-note'); if (el) el.textContent = t; };

    const search = panel.querySelector<HTMLInputElement>('#god-search');
    search?.addEventListener('input', () => {
      filter = search.value;
      const pos = search.selectionStart ?? filter.length;
      render();
      const again = panel.querySelector<HTMLInputElement>('#god-search');
      again?.focus(); again?.setSelectionRange(pos, pos);
    });

    panel.querySelector('#god-off')?.addEventListener('click', () => {
      const w2 = getWorld(), me = getMe();
      if (w2 && me) w2.godMorph(me, null);
      hide();
    });
    panel.querySelector('#god-heal')?.addEventListener('click', () => {
      const me = getMe();
      if (!me) return;
      me.hp = me.maxHp; me.armor = me.maxArmor;
      say('healed to full');
    });
    panel.querySelector('#god-cd')?.addEventListener('click', () => {
      const me = getMe();
      if (!me) return;
      me.nextLswActiveAt = 0; me.nextAbilityAt = 0; me.nextGrenadeAt = 0;
      say('cooldowns reset');
    });
    panel.querySelector('#god-nocd')?.addEventListener('click', () => {
      noCd = !noCd;
      render();
    });
    panel.querySelector('#god-sky')?.addEventListener('click', () => {
      const w2 = getWorld();
      if (!w2) return;
      const next = SKIES[(SKIES.indexOf(w2.weather.kind) + 1) % SKIES.length];
      // a forced sky is pinned for ten minutes — the bench outlasts the front
      w2.weather = { kind: next, intensity: next === 'clear' ? 0 : 0.85, until: w2.time + 600 };
      render();
    });
    panel.querySelector('#god-cull')?.addEventListener('click', () => {
      const w2 = getWorld(), me = getMe();
      if (!w2 || !me) return;
      let culled = 0;
      for (const s of w2.soldiers.values()) {
        if (s.alive && s.ascendant && s.team !== me.team) { w2.damageSoldier(s, 1e9, -1, 'gl'); culled++; }
      }
      say(culled ? 'enemy god struck down' : 'no enemy god on the field');
    });
    for (const b of Array.from(panel.querySelectorAll<HTMLElement>('.god-pick'))) {
      b.addEventListener('click', (ev) => {
        const w2 = getWorld(), me = getMe();
        if (!w2 || !me) return;
        const id = b.dataset.id as AscendantId;
        if ((ev as MouseEvent).shiftKey) {
          // SPAWN AS A BOT: the sparring partner lands ~18u out on its own
          // faction. addLsw enforces the one-god-per-team law — if the slot
          // is taken, the bench says so instead of silently doing nothing.
          const a = Math.random() * Math.PI * 2;
          const at = { x: me.pos.x + Math.cos(a) * 18, y: 0, z: me.pos.z + Math.sin(a) * 18 };
          const got = w2.addLsw(id, LSWS[id].faction, at);
          say(got ? `${LSWS[id].name} is on the field` : 'slot taken — that faction already has a god live (KILL ENEMY GOD first)');
          return;
        }
        w2.godMorph(me, id);
        hide();
      });
    }
  };

  const hide = () => { open = false; panel.style.display = 'none'; document.exitPointerLock?.(); };
  const show = () => { open = true; note = ''; render(); panel.style.display = 'block'; document.exitPointerLock?.(); };

  window.addEventListener('keydown', (e) => {
    if (e.code !== 'Backquote') return;
    if (!getWorld() || !getMe()) return; // only inside a live match
    e.preventDefault();
    e.stopPropagation();
    if (open) hide(); else show();
  }, true); // capture: beat the game's own input handler to the key

  // typing in the search box must not fire the game's WASD underneath
  panel.addEventListener('keydown', (e) => e.stopPropagation());
}
