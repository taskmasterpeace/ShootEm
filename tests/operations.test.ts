import { describe, expect, it } from 'vitest';
import {
  COMBINED_ARMS_SIGNATURES,
  OPERATION_COMPLICATIONS,
  OPERATION_EFFECTS,
  OPERATION_SITES,
  OPERATION_VERBS,
  commitmentFor,
  generateOperation,
  manifestCost,
  validateManifest,
  type OperationHull,
  type OperationManifest,
} from '../src/sim/operations';

const inventory: OperationHull[] = [
  { id: 'tank-ares-01', kind: 'tank', name: 'Ares One', status: 'available' },
  { id: 'apc-bastion-01', kind: 'apc', name: 'Bastion One', status: 'available' },
  { id: 'falcon-01', kind: 'interceptor', name: 'Falcon One', status: 'available' },
  { id: 'vulture-01', kind: 'strikejet', name: 'Vulture One', status: 'available' },
  { id: 'anvil-01', kind: 'bomber', name: 'Anvil One', status: 'available' },
  { id: 'kestrel-01', kind: 'flyer', name: 'Kestrel One', status: 'available' },
  { id: 'pike-01', kind: 'boat', name: 'Pike One', status: 'available' },
  { id: 'lost-tank', kind: 'tank', name: 'Ares Lost', status: 'lost' },
];

describe('Military Operations catalog', () => {
  it('ships the complete authored vocabulary with unique stable ids', () => {
    expect(OPERATION_VERBS).toHaveLength(15);
    expect(OPERATION_SITES).toHaveLength(10);
    expect(OPERATION_COMPLICATIONS).toHaveLength(7);
    expect(OPERATION_EFFECTS).toHaveLength(50);
    expect(COMBINED_ARMS_SIGNATURES).toHaveLength(4);

    for (const catalog of [OPERATION_VERBS, OPERATION_SITES, OPERATION_COMPLICATIONS, OPERATION_EFFECTS, COMBINED_ARMS_SIGNATURES]) {
      expect(new Set(catalog.map((entry) => entry.id)).size).toBe(catalog.length);
    }
    expect(new Set(OPERATION_EFFECTS.map((effect) => effect.category))).toEqual(
      new Set(['territory', 'facility', 'materiel', 'control', 'doctrine']),
    );
  });

  it('keeps every verb compatible with at least one site and emits real objective phases', () => {
    const siteIds = new Set(OPERATION_SITES.map((site) => site.id));
    for (const verb of OPERATION_VERBS) {
      expect(verb.sites.length, verb.id).toBeGreaterThan(0);
      expect(verb.sites.every((site) => siteIds.has(site)), verb.id).toBe(true);
      expect(verb.phases.length, verb.id).toBeGreaterThan(0);
    }
  });
});

describe('Military Operation generation', () => {
  const base = { seed: 7749, frontId: 'highland_pass', frontName: 'Highland Pass' } as const;

  it('is deterministic and legible from explicit inputs', () => {
    const a = generateOperation({ ...base, pass: 2 });
    const b = generateOperation({ ...base, pass: 2 });
    expect(a).toEqual(b);
    expect(a.id).toBe('highland_pass:p2:7749');
    expect(a.briefing).toContain('Highland Pass');
    expect(a.briefing.length).toBeGreaterThan(40);
    expect(a.phases.length).toBeGreaterThanOrEqual(2);
  });

  it('escalates scale and combined arms by pass', () => {
    const p1 = generateOperation({ ...base, pass: 1 });
    const p2 = generateOperation({ ...base, pass: 2 });
    const p3 = generateOperation({ ...base, pass: 3 });
    expect(p1.scale).toBe('skirmish');
    expect(p1.domains).toHaveLength(1);
    expect(p2.scale).toBe('standard');
    expect(p2.domains.length).toBeGreaterThanOrEqual(2);
    expect(p3.scale).toBe('large');
    expect(p3.domains.length).toBeGreaterThanOrEqual(2);
    expect(p1.launchCost).toBeLessThan(p2.launchCost);
    expect(p2.launchCost).toBeLessThan(p3.launchCost);
  });

  it('only produces compatible sites and a primary verb matching its primary domain', () => {
    for (let pass = 1 as 1 | 2 | 3; pass <= 3; pass = (pass + 1) as 1 | 2 | 3) {
      for (let seed = 1; seed <= 100; seed++) {
        const plan = generateOperation({ seed, pass, frontId: 'the_port', frontName: 'The Port' });
        const verb = OPERATION_VERBS.find((entry) => entry.id === plan.verb)!;
        expect(verb.domain).toBe(plan.domains[0]);
        expect(verb.sites).toContain(plan.site);
        expect(plan.phases.every((phase) => plan.domains.includes(phase.domain))).toBe(true);
      }
    }
  });
});

describe('Operation manifest', () => {
  const beachhead = generateOperation({ seed: 17, pass: 2, frontId: 'the_port', frontName: 'The Port', signatureId: 'beachhead' });

  it('prices actual selected hulls, ammunition, and support', () => {
    const manifest: OperationManifest = { hullIds: ['tank-ares-01', 'pike-01'], ammunition: 2, support: 'cas' };
    expect(manifestCost(manifest, inventory)).toBe(10); // tank 4 + Pike 2 + ammo 1 + CAS 3
  });

  it('rejects missing domains, duplicate or unavailable hulls, and invalid support', () => {
    const result = validateManifest(beachhead, {
      hullIds: ['tank-ares-01', 'tank-ares-01', 'lost-tank'],
      ammunition: 0,
      support: 'artillery',
    }, inventory);
    expect(result.ok).toBe(false);
    expect(result.errors).toContain('Manifest contains duplicate hull tank-ares-01.');
    expect(result.errors).toContain('Ares Lost is not available.');
    expect(result.errors).toContain('SEA commitment requires at least 1 hull.');
    expect(result.errors).toContain('Commit at least 1 ammunition allotment.');
    expect(result.errors).toContain('This Operation does not authorize artillery support.');
  });

  it('accepts a valid Beachhead and grades commitment from light to heavy', () => {
    const light: OperationManifest = { hullIds: ['tank-ares-01', 'pike-01'], ammunition: 1, support: 'none' };
    const balanced: OperationManifest = { hullIds: ['tank-ares-01', 'pike-01', 'falcon-01'], ammunition: 2, support: 'none' };
    const heavy: OperationManifest = { hullIds: ['tank-ares-01', 'apc-bastion-01', 'pike-01', 'falcon-01', 'vulture-01'], ammunition: 4, support: 'cas' };
    expect(validateManifest(beachhead, light, inventory)).toMatchObject({ ok: true, commitment: 'light' });
    expect(commitmentFor(beachhead, balanced, inventory)).toBe('balanced');
    expect(commitmentFor(beachhead, heavy, inventory)).toBe('heavy');
  });
});
