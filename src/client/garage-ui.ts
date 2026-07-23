// ---------------------------------------------------------------------------
// THE GARAGE, on screen (docs/RACING.md). Four slots, the shop's voice, and
// the CARD updating live as you bolt things on — because the whole point of
// Racing Destruction Set's card was that you could read the machine before
// you drove it.
//
// The fit belongs to the ACCOUNT (it survives prints, like licences), stored
// per machine so your muscle car and your rally truck keep separate setups.
// ---------------------------------------------------------------------------
import { VEHICLES } from '../sim/data';
import {
  CARGO, CHASSIS, DEFAULT_FIT, ENGINES, TIRES, accelRating, fitted,
  type CargoId, type ChassisId, type EngineId, type Fit, type TireId,
} from '../sim/garage';
import type { VehicleKind } from '../sim/types';

const KEY = 'ww_fits';

export const fitStorage = {
  get(): string | null { try { return localStorage.getItem(KEY); } catch { return null; } },
  set(v: string): void { try { localStorage.setItem(KEY, v); } catch { /* private mode */ } },
};

export function loadFits(): Record<string, Fit> {
  try { return JSON.parse(fitStorage.get() ?? '{}') as Record<string, Fit>; }
  catch { return {}; }
}

export function fitFor(kind: VehicleKind): Fit {
  const f = loadFits()[kind];
  if (!f) return { ...DEFAULT_FIT, cargo: [] };
  return {
    tires: TIRES[f.tires] ? f.tires : 'allterrain',
    engine: ENGINES[f.engine] ? f.engine : 'stock',
    chassis: CHASSIS[f.chassis] ? f.chassis : 'standard',
    cargo: Array.isArray(f.cargo) ? f.cargo.filter((c) => !!CARGO[c]).slice(0, 2) : [],
  };
}

export function saveFit(kind: VehicleKind, fit: Fit): void {
  const all = loadFits();
  all[kind] = fit;
  fitStorage.set(JSON.stringify(all));
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

/** THE CARD, as fitted — the readout that made RDS's screen worth reading. */
function cardHtml(kind: VehicleKind, fit: Fit): string {
  const d = fitted(kind, fit);
  const t = d.traction!;
  const bar = (v: number, max = 1.6) => {
    const n = Math.max(0, Math.min(10, Math.round((v / max) * 10)));
    return `<span class="gc-bar">${'█'.repeat(n)}${'░'.repeat(10 - n)}</span>`;
  };
  return `
    <div class="gc-card">
      <div class="gc-name">${esc(VEHICLES[kind]?.name ?? kind)}</div>
      <div class="gc-line"><span>TRACTION · ICE</span>${bar(t.ice)}<b>${t.ice.toFixed(2)}</b></div>
      <div class="gc-line"><span>TRACTION · DIRT</span>${bar(t.dirt)}<b>${t.dirt.toFixed(2)}</b></div>
      <div class="gc-line"><span>TRACTION · PAVED</span>${bar(t.paved)}<b>${t.paved.toFixed(2)}</b></div>
      <div class="gc-line"><span>WEIGHT</span>${bar(d.mass ?? 1.6, 8)}<b>${(d.mass ?? 1.6).toFixed(2)}t</b></div>
      <div class="gc-line"><span>TOP SPEED</span>${bar(d.speed, 33)}<b>${d.speed.toFixed(1)}</b></div>
      <div class="gc-line"><span>ACCELERATION</span>${bar(accelRating(kind, fit), 10)}<b>${accelRating(kind, fit)}</b></div>
      <div class="gc-line"><span>HULL</span>${bar(d.hp, 260)}<b>${d.hp}</b></div>
      <div class="gc-line"><span>SHOCK STRENGTH</span>${bar(d.shock ?? 4, 16)}<b>${Math.round(d.shock ?? 4)}</b></div>
    </div>`;
}

function slotHtml(label: string, parts: { id: string; name: string; blurb: string }[], active: string, slot: string): string {
  const opts = parts.map((p) => `
    <button class="gs-part${p.id === active ? ' on' : ''}" data-slot="${slot}" data-part="${p.id}">
      <b>${esc(p.name)}</b><span>${esc(p.blurb)}</span>
    </button>`).join('');
  return `<div class="gs-slot"><div class="gs-label">${label}</div><div class="gs-parts">${opts}</div></div>`;
}

/**
 * Mount the garage for one machine. Re-renders in place on every change so
 * the card and the parts always agree.
 */
export function renderGarage(host: HTMLElement, kind: VehicleKind, onChange?: (fit: Fit) => void): void {
  const paint = () => {
    const fit = fitFor(kind);
    const cargoHtml = (Object.keys(CARGO) as CargoId[]).map((c) => `
      <button class="gs-part${fit.cargo.includes(c) ? ' on' : ''}" data-slot="cargo" data-part="${c}">
        <b>${esc(CARGO[c].name)}</b><span>${esc(CARGO[c].blurb)}</span>
        <i>+${CARGO[c].mass.toFixed(2)}t</i>
      </button>`).join('');
    host.innerHTML = `
      <div class="gs-intro">THE GARAGE — four slots. Every fit costs you something; nothing here is strictly better than anything else. The card updates as you bolt it on.</div>
      <div class="gs-body">
        <div class="gs-slots">
          ${slotHtml('Tyres', Object.values(TIRES), fit.tires, 'tires')}
          ${slotHtml('Engine', Object.values(ENGINES), fit.engine, 'engine')}
          ${slotHtml('Chassis', Object.values(CHASSIS), fit.chassis, 'chassis')}
          <div class="gs-slot"><div class="gs-label">Cargo <span class="gs-hint">(two slots — every item is weight)</span></div><div class="gs-parts">${cargoHtml}</div></div>
        </div>
        ${cardHtml(kind, fit)}
      </div>`;
    host.querySelectorAll<HTMLButtonElement>('.gs-part').forEach((b) => {
      b.onclick = () => {
        const cur = fitFor(kind);
        const slot = b.dataset.slot!;
        const part = b.dataset.part!;
        if (slot === 'cargo') {
          const has = cur.cargo.includes(part as CargoId);
          const next = has ? cur.cargo.filter((c) => c !== part) : [...cur.cargo, part as CargoId];
          // two slots, never more — the shop stays shallow on purpose
          cur.cargo = next.slice(-2);
        } else if (slot === 'tires') cur.tires = part as TireId;
        else if (slot === 'engine') cur.engine = part as EngineId;
        else if (slot === 'chassis') cur.chassis = part as ChassisId;
        saveFit(kind, cur);
        onChange?.(cur);
        paint();
      };
    });
  };
  paint();
}
