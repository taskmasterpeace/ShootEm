import type { Soldier } from '../sim/types';

export interface K9ControlState {
  visible: boolean;
  disabled: boolean;
  status: 'HEEL' | 'STAY' | 'CLEARING' | 'WAITING · DOOR';
  stayLabel: 'STAY' | 'HEEL';
  dog?: Soldier;
}

/** Derive the handler panel entirely from replicated simulation state. */
export function k9ControlState(local: Soldier, soldiers: Iterable<Soldier>): K9ControlState {
  const dog = [...soldiers].find((candidate) =>
    candidate.kind === 'dog' && candidate.ownerId === local.id && candidate.alive,
  );
  const visible = local.alive && !local.downed && !!dog;
  const order = dog?.k9Order ?? 'heel';
  const status = order === 'stay' ? 'STAY'
    : order === 'sic' ? (dog?.k9Door !== undefined ? 'WAITING · DOOR' : 'CLEARING')
      : 'HEEL';
  return {
    visible,
    disabled: !visible,
    status,
    stayLabel: order === 'stay' ? 'HEEL' : 'STAY',
    dog,
  };
}

export function k9MarkerKind(soldier: Soldier): 'sic' | 'stay' | null {
  if (soldier.kind !== 'dog' || !soldier.alive) return null;
  return soldier.k9Order === 'sic' || soldier.k9Order === 'stay' ? soldier.k9Order : null;
}
