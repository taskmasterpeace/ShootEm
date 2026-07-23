// ---------------------------------------------------------------------------
// PERSONAL MAIL — the GONET's inbox.
//
// The mock said `Personal Mail  4`. This is the four.
//
// Every message is DERIVED from something true about the account: the flag you
// enlisted under, what the war chest holds, which papers you hold and which
// you don't, the times on the board, the psych desk's read of you. Mail that
// invents facts would be set dressing; mail that reports them is the world
// talking to you.
//
// Pure generation + a read-state store. No DOM.
// ---------------------------------------------------------------------------
import { LICENCES, type LicenceId } from '../../sim/licenses';
import { COURSES } from '../../sim/courses';
import { factionLabel, type PlayerIdentity } from '../identity';
import { loadLicences } from '../licences';
import { allRecords } from '../records';
import { treasuryFor, budgetMultiplier } from '../treasury';

export type MailKind = 'ministry' | 'squad' | 'board' | 'home' | 'news' | 'school';

export interface Message {
  id: string;
  from: string;
  /** the desk it came off — drives the tag colour */
  kind: MailKind;
  subject: string;
  body: string;
  /** relative dateline, e.g. "TODAY 06:12" */
  when: string;
  /** an action the message can hand you, if any */
  cta?: { label: string; app: string };
}

const KEY = 'ww.mail.v1';

interface MailState { read: string[]; }

function loadState(): MailState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<MailState>;
      return { read: Array.isArray(p.read) ? p.read : [] };
    }
  } catch { /* private mode */ }
  return { read: [] };
}

function saveState(s: MailState): void {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* private mode */ }
}

export function isRead(id: string): boolean { return loadState().read.includes(id); }

export function markRead(id: string): void {
  const s = loadState();
  if (!s.read.includes(id)) { s.read.push(id); saveState(s); }
}

export function markAllRead(ids: string[]): void {
  const s = loadState();
  for (const id of ids) if (!s.read.includes(id)) s.read.push(id);
  saveState(s);
}

export function unreadCount(msgs: Message[]): number {
  const read = loadState().read;
  return msgs.filter((m) => !read.includes(m.id)).length;
}

/**
 * Build the inbox from what is actually true right now.
 * `hour` is the world clock's hour, so datelines match the one clock.
 */
export function buildInbox(id: PlayerIdentity | null, hour = 6): Message[] {
  const msgs: Message[] = [];
  const stamp = (h: number) => `TODAY ${String(h).padStart(2, '0')}:${String((h * 7) % 60).padStart(2, '0')}`;
  const who = id?.callsign ?? 'SOLDIER';
  const side = id ? factionLabel(id.faction).toUpperCase() : 'THE FRONT';

  // ── THE MINISTRY: the war chest, in plain language ────────────────────────
  if (id) {
    const t = treasuryFor(id.faction);
    const mult = budgetMultiplier(id.faction);
    const band = mult >= 1.25 ? 'the whole stable is open to you'
      : mult >= 1 ? 'you may draw a full manifest'
        : mult >= 0.8 ? 'draw lean — we are watching every round'
          : 'take what is in the shed and make it do';
    msgs.push({
      id: 'ministry_chest',
      from: `MINISTRY OF WAR · ${side}`,
      kind: 'ministry',
      subject: `Funding notice — ${t.balance.toLocaleString()} on the books`,
      when: stamp(hour),
      body: `${who},\n\nThe chest stands at ${t.balance.toLocaleString()}. Record to date: ${t.wins} won, ${t.losses} lost.\n\nOn current funding, ${band}.\n\n${t.lastReason}\n\nSpend it like it is somebody's taxes, because it is.`,
      cta: { label: 'OPEN THE FILE', app: 'file' },
    });
  }

  // ── THE SCHOOLS: the next paper you could hold ───────────────────────────
  const lic = loadLicences();
  const all = Object.keys(COURSES) as LicenceId[];
  const held = all.filter((l) => lic.held.includes(l));
  const open = all.filter((l) => !lic.held.includes(l));
  if (open.length) {
    const next = open[0];
    msgs.push({
      id: `school_${next}`,
      from: 'MOTOR POOL · TRAINING COMMAND',
      kind: 'school',
      subject: `You are not certified for ${LICENCES[next].name}`,
      when: stamp(Math.max(0, hour - 2)),
      body: `${who},\n\nOur register shows ${held.length} of ${all.length} certifications against your name.\n\n${LICENCES[next].name} is open to you. It is taught at ${LICENCES[next].school}. Bring nothing; the machine is provided.\n\nA driver without paper is a passenger with opinions.`,
      cta: { label: 'THE SCHOOLS', app: 'deploy' },
    });
  } else {
    msgs.push({
      id: 'school_complete',
      from: 'MOTOR POOL · TRAINING COMMAND',
      kind: 'school',
      subject: 'Every certification held — the register is closed',
      when: stamp(Math.max(0, hour - 2)),
      body: `${who},\n\nAll ${all.length} certifications stand against your name. There is nothing left here we can teach you.\n\nThe hangar is yours. Try not to bend anything expensive.`,
    });
  }

  // ── THE BOARD: your times ────────────────────────────────────────────────
  const recs = allRecords();
  if (recs.length) {
    const best = recs.slice().sort((a, b) => a.lap - b.lap)[0];
    msgs.push({
      id: 'board_times',
      from: 'THE BOARD · CIRCUIT OFFICE',
      kind: 'board',
      subject: `${recs.length} time${recs.length === 1 ? '' : 's'} filed against your name`,
      when: stamp(Math.max(0, hour - 4)),
      body: `${who},\n\nYour standing entry: ${best.trackId} in ${best.lap.toFixed(1)}s (${best.cls.toUpperCase()}).\n\nThe board keeps every run. Beat it and we will say so; do not and it stands.`,
      cta: { label: 'THE BOARD', app: 'file' },
    });
  } else {
    msgs.push({
      id: 'board_empty',
      from: 'THE BOARD · CIRCUIT OFFICE',
      kind: 'board',
      subject: 'No times filed — every track is open',
      when: stamp(Math.max(0, hour - 4)),
      body: `${who},\n\nThe board has nothing against your name. That is not a criticism; it is an invitation.\n\nEvery circuit is open and every record is somebody else's until it is not.`,
    });
  }

  // ── HOME: the hometown notices the intake promised ───────────────────────
  if (id?.hometown) {
    msgs.push({
      id: 'home_notice',
      from: `${id.hometown.toUpperCase()} · CIVIC NOTICE`,
      kind: 'home',
      subject: `A letter from ${id.hometown}`,
      when: stamp(Math.max(0, hour - 9)),
      body: `They are still putting your name in the paper back home.\n\nThe civic office asks that deployed personnel from ${id.hometown} write when they are able. The lines are open more often than people think.\n\nSomebody keeps the porch light on. That is the whole message.`,
    });
  }

  // ── THE SQUAD: two waiting, per the mock ─────────────────────────────────
  msgs.push({
    id: 'squad_waiting',
    from: 'YOUR SQUAD',
    kind: 'squad',
    subject: 'Two of us are already at the pad',
    when: stamp(hour),
    body: `We are kitted and waiting. The board says the front is moving and nobody upstairs has told us which way.\n\nIf you are coming, come now. If you are not, say so and we will draw a bot for your slot — but it will not be the same and everybody knows it.`,
    cta: { label: 'DEPLOY', app: 'deploy' },
  });

  // ── THE PSYCH DESK's read, quoted back at you ────────────────────────────
  if (id?.psych?.temperament) {
    msgs.push({
      id: 'ministry_psych',
      from: 'PERSONNEL · PSYCHOLOGICAL SERVICES',
      kind: 'ministry',
      subject: 'Your file has been reviewed (routine)',
      when: stamp(Math.max(0, hour - 11)),
      body: `${who},\n\nThe desk's standing read on you is ${String(id.psych.temperament).toUpperCase()}.\n\nThis is not a judgement and it does not restrict your assignment. It is written down because somebody has to write things down.\n\nYou may request a re-read at any intake window.`,
    });
  }

  return msgs;
}
