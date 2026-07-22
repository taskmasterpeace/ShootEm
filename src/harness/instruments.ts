import { renderVehicleInstruments, vehicleInstrumentState, type VehicleInstrumentInput } from '../client/hud';

interface Fixture { id: string; label: string; notes: string; input: VehicleInstrumentInput }

const base = (over: Partial<VehicleInstrumentInput>): VehicleInstrumentInput => ({
  kind: 'interceptor', yaw: 0, vel: { x: 32, y: 0, z: 0 }, band: 3,
  submerged: false, burnerOn: false, spoolRemaining: 0,
  sensorsHp: 14, sensorsMax: 14,
  radar: { source: 'fixedWing', range: 500, freshTracks: 3, jammed: false },
  locked: false, ...over,
});

const fixtures: Fixture[] = [
  { id: 'interceptor', label: 'INTERCEPTOR / CRUISE', notes: 'Fixed-wing cruise · Clouds · three fresh air/surface returns.', input: base({}) },
  { id: 'strike-ab', label: 'STRIKEJET / AB', notes: 'Afterburner drives the live needle beyond cruise while the digital percentage stays explicit.', input: base({ kind: 'strikejet', vel: { x: 48, y: 0, z: 0 }, band: 2, burnerOn: true, sensorsHp: 16, sensorsMax: 16 }) },
  { id: 'shrike-spool', label: 'SHRIKE / SPOOL', notes: 'Rotorcraft spool countdown, grounded altitude pip and short-range rotor radar.', input: base({ kind: 'attackheli', vel: { x: 0, y: 0, z: 0 }, band: 0, spoolRemaining: 2.4, sensorsHp: 24, sensorsMax: 24, radar: { source: 'rotorcraft', range: 90, freshTracks: 1, jammed: false } }) },
  { id: 'condor-team', label: 'CONDOR / TEAM RADAR', notes: 'Staffed sensor station shares the strongest 160-unit picture.', input: base({ kind: 'transportheli', vel: { x: 18, y: 0, z: 4 }, band: 2, sensorsHp: 42, sensorsMax: 42, radar: { source: 'staffedSensors', range: 160, freshTracks: 6, jammed: false } }) },
  { id: 'barracuda', label: 'BARRACUDA / SONAR', notes: 'Submerged navigation replaces altitude with depth and excludes all air returns.', input: base({ kind: 'submarine', vel: { x: 8, y: 0, z: 0 }, band: 0, submerged: true, sensorsHp: 60, sensorsMax: 60, radar: { source: 'sonar', range: 80, freshTracks: 2, jammed: false } }) },
  { id: 'sensor-dead', label: 'SENSOR DAMAGED', notes: 'Destroyed sensors fail closed; old tracks fade rather than refreshing.', input: base({ sensorsHp: 0, radar: null }) },
  { id: 'jammed', label: 'JAMMED', notes: 'Live enemy ECM shortens reach, offsets the observed point and draws uncertainty rings.', input: base({ radar: { source: 'fixedWing', range: 500, freshTracks: 4, jammed: true } }) },
  { id: 'lock', label: 'MISSILE INBOUND', notes: 'Threat state is red, animated and repeated in text; color is never the only warning.', input: base({ locked: true }) },
];

const nav = document.getElementById('instrument-fixtures')!;
const plate = document.getElementById('vehicle-instruments')!;
const notes = document.getElementById('fixture-notes')!;
const canvas = document.getElementById('scope-fixture') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

function drawScope(fixture: Fixture): void {
  const size = canvas.width;
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = '#11130f'; ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = 'rgba(232, 163, 61, 0.28)'; ctx.lineWidth = 2;
  for (const radius of [85, 170, 245]) { ctx.beginPath(); ctx.arc(size / 2, size / 2, radius, 0, Math.PI * 2); ctx.stroke(); }
  ctx.strokeStyle = 'rgba(232, 163, 61, 0.72)'; ctx.beginPath(); ctx.moveTo(size / 2, size / 2); ctx.lineTo(size / 2 + 205, size / 2 - 110); ctx.stroke();
  ctx.fillStyle = '#e8d9a0'; ctx.font = '16px "Share Tech Mono", monospace';
  const source = fixture.input.radar?.source === 'sonar'
    ? `SONAR ${fixture.input.radar.range}`
    : fixture.input.radar?.source === 'staffedSensors'
      ? `RDR TEAM ${fixture.input.radar.range}`
      : `RDR AIR ${fixture.input.radar?.range ?? 0}`;
  ctx.fillText(`${source}${fixture.input.radar?.jammed ? ' · JAM' : ''}`, 16, 25);
  const marks: Array<[number, number, 'sub' | 'surface' | 'air' | 'ground']> = fixture.input.radar?.source === 'sonar'
    ? [[315, 330, 'sub'], [205, 170, 'surface']]
    : [[345, 190, 'air'], [160, 310, 'ground'], [230, 135, 'air']];
  for (const [x, y, kind] of marks) {
    ctx.strokeStyle = '#ff5040'; ctx.lineWidth = 3;
    if (fixture.input.radar?.jammed) { ctx.beginPath(); ctx.arc(x, y, 22, 0, Math.PI * 2); ctx.stroke(); }
    if (kind === 'air') { ctx.beginPath(); ctx.moveTo(x, y - 9); ctx.lineTo(x + 8, y + 7); ctx.lineTo(x - 8, y + 7); ctx.closePath(); ctx.stroke(); }
    else if (kind === 'ground') ctx.strokeRect(x - 7, y - 7, 14, 14);
    else if (kind === 'surface') { ctx.beginPath(); ctx.moveTo(x - 10, y - 5); ctx.lineTo(x, y + 7); ctx.lineTo(x + 10, y - 5); ctx.stroke(); }
    else { ctx.beginPath(); ctx.arc(x, y - 2, 10, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke(); ctx.beginPath(); ctx.arc(x, y + 2, 10, 1.15 * Math.PI, 1.85 * Math.PI); ctx.stroke(); }
  }
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(size / 2, size / 2, 6, 0, Math.PI * 2); ctx.fill();
}

function showFixture(id: string): void {
  const fixture = fixtures.find((candidate) => candidate.id === id) ?? fixtures[0];
  const state = vehicleInstrumentState(fixture.input);
  plate.innerHTML = renderVehicleInstruments(state);
  plate.setAttribute('aria-label', `${fixture.label}: ${state.speedText} units per second, ${state.headingText}, ${state.radarText}, ${state.threatText}`);
  notes.textContent = fixture.notes;
  for (const button of nav.querySelectorAll<HTMLButtonElement>('button')) button.classList.toggle('active', button.dataset.fixture === fixture.id);
  drawScope(fixture);
}

for (const fixture of fixtures) {
  const button = document.createElement('button');
  button.className = 'fixture-button'; button.dataset.fixture = fixture.id; button.textContent = fixture.label;
  button.onclick = () => showFixture(fixture.id); nav.append(button);
}
showFixture(fixtures[0].id);

Object.assign(window, { __wwInstruments: { fixtures: fixtures.map((fixture) => fixture.id), show: showFixture, state: () => plate.getAttribute('aria-label') } });
