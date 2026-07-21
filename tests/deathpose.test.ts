// ---------------------------------------------------------------------------
// COLLAPSE STYLE (STATUS §2 — "deaths differ by weapon: fire collapse, laser
// drop-straight, melee spin"). collapseStyleFor maps the killing weapon's shape
// to how the body goes down. Pinned here so the mapping can't quietly drift.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { collapseStyleFor } from '../src/client/deathpose';

describe('collapseStyleFor — the body falls by the weapon', () => {
  it('a clean energy kill (beam/rail) drops you STRAIGHT', () => {
    expect(collapseStyleFor({ tracer: 'beam', range: 40 })).toBe('straight');
    expect(collapseStyleFor({ tracer: 'rail', range: 125 })).toBe('straight');
  });

  it('fire makes you WRITHE', () => {
    expect(collapseStyleFor({ tracer: 'flame', range: 16 })).toBe('writhe');
  });

  it('a melee blow (short reach) SPINS you down', () => {
    expect(collapseStyleFor({ tracer: 'bullet', range: 2.2 })).toBe('spin'); // a knife
    expect(collapseStyleFor({ range: 2.5 })).toBe('spin');                    // exactly at reach
  });

  it('a normal round topples the DEFAULT way; no weapon → default', () => {
    expect(collapseStyleFor({ tracer: 'bullet', range: 66 })).toBe('default'); // rifle
    expect(collapseStyleFor({ tracer: 'shell', range: 26 })).toBe('default');  // shotgun
    expect(collapseStyleFor(undefined)).toBe('default');
  });
});
