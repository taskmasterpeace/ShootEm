import { describe, expect, it } from 'vitest';
import { k9ControlState, k9MarkerKind } from '../src/client/k9-controls';
import type { Soldier } from '../src/sim/types';

const soldier = (over: Partial<Soldier>): Soldier => ({
  id: 1, kind: 'human', team: 0, alive: true, downed: false, ownerId: -1,
  name: 'Handler', pos: { x: 0, y: 0, z: 0 },
  ...over,
} as Soldier);

describe('K9 handler controls', () => {
  it('only shows for a living handler with a living owned dog', () => {
    const handler = soldier({ id: 7 });
    const dog = soldier({ id: 8, kind: 'dog', ownerId: 7, k9Order: 'heel' });
    expect(k9ControlState(handler, [handler, dog])).toMatchObject({
      visible: true, disabled: false, status: 'HEEL', stayLabel: 'STAY',
    });
    expect(k9ControlState(soldier({ id: 9 }), [handler, dog]).visible).toBe(false);
    expect(k9ControlState({ ...handler, alive: false }, [handler, dog]).visible).toBe(false);
    expect(k9ControlState(handler, [handler, { ...dog, alive: false }]).visible).toBe(false);
  });

  it('labels the Stay control as Heel while the dog is holding', () => {
    const handler = soldier({ id: 7 });
    const dog = soldier({ id: 8, kind: 'dog', ownerId: 7, k9Order: 'stay' });
    expect(k9ControlState(handler, [handler, dog])).toMatchObject({
      status: 'STAY', stayLabel: 'HEEL',
    });
  });

  it('describes clearing and blocked-door states from replicated sim truth', () => {
    const handler = soldier({ id: 7 });
    const dog = soldier({ id: 8, kind: 'dog', ownerId: 7, k9Order: 'sic', k9BuildingId: 3 });
    expect(k9ControlState(handler, [handler, dog]).status).toBe('CLEARING');
    expect(k9ControlState(handler, [handler, { ...dog, k9Door: 410 }]).status).toBe('WAITING · DOOR');
  });

  it('maps only active orders to compact world markers', () => {
    expect(k9MarkerKind(soldier({ kind: 'dog', k9Order: 'sic' }))).toBe('sic');
    expect(k9MarkerKind(soldier({ kind: 'dog', k9Order: 'stay' }))).toBe('stay');
    expect(k9MarkerKind(soldier({ kind: 'dog', k9Order: 'heel' }))).toBeNull();
    expect(k9MarkerKind(soldier({ kind: 'human', k9Order: 'sic' }))).toBeNull();
  });
});
