import { scienceReward, type ScienceRewardId } from '../sim/science';

// ---------------------------------------------------------------------------

export interface SciencePressData {
  id: string;
  briefing: string;
  clonesSpent: number;
  clonesRemaining: number;
  ghost: boolean;
  reward: ScienceRewardId;
}
// N1 THE FRONT COURIER (Robert: "we could literally make newspapers when
// people take over different fronts — to show all the three things that
// happened").
//
// A war has a press. Every finished battle files an ISSUE: a masthead, a main
// headline about the front, and THREE stories built from what actually
// happened — the duel, the money, and the field. Issues are archived as DATA
// (never stored HTML), so an old paper survives any redesign of the page
// that prints it.
// ---------------------------------------------------------------------------

// THE SPORTS DESK (Robert: "improve racing… also tie it into the news").
// A finished race files its own press story — the winner, the time, and
// whether a record fell — so the circuit lives in the same paper the war does.
export interface RacePressData {
  discipline: string;    // 'CIRCUIT RACING', 'TIME ATTACK', 'DEMOLITION'
  venue: string;         // the track id / circuit name
  cls: string;           // 'CAR' | 'BIKE' | 'TRUCK' | 'BOARD'
  winner: string;        // who took it
  lap: number;           // best lap, seconds (0 = none set)
  field: number;         // how many on the grid
  recordTaken: boolean;  // a track record fell
  previousHolder?: string; // whose record it was
}

export interface OperationPressFacts {
  codename: string;
  site: string;
  outcome: 'victory' | 'defeat';
  hullsLost: number;
  aceHull?: string;
  objectivesCompleted: number;
  objectivesTotal: number;
  reward?: string;
}

export interface PressIssue {
  at: number;                 // real-world print time
  season: number;
  frontName?: string;         // named front, if the battle was on the Scar
  controlAfter?: number;      // the front's control after the battle
  controlDelta?: number;
  won: boolean;               // from the local player's side
  modeName: string;
  // the duel
  aceName: string;
  aceKills: number;
  longestShot: number;        // in units, 0 = nobody bragged
  // the money (B1's ledger)
  myCost: number;
  theirCost: number;
  underdog: boolean;          // underfunded victory for OUR side
  morale?: number;            // morale after banking it
  // the field
  myKills: number;
  theirKills: number;
  medals: string[];           // "🎖 name" strings, already formatted
  science?: SciencePressData;
  operation?: OperationPressFacts;
  race?: RacePressData;
}

const KEY = 'ww_press';
const KEEP = 12; // a stack of a dozen papers on the table — older ones wrap fish

export function loadPress(): PressIssue[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as PressIssue[];
    return Array.isArray(arr) ? arr.filter((i) => typeof i?.at === 'number') : [];
  } catch {
    return [];
  }
}

export function savePress(issues: PressIssue[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(issues.slice(0, KEEP)));
  } catch { /* private mode — the presses jam quietly */ }
}

export function fileIssue(issue: PressIssue) {
  const all = loadPress();
  all.unshift(issue);
  savePress(all);
}

// ── the copy desk ───────────────────────────────────────────────────────────
// Headlines are picked by a stable hash of the issue so the same battle
// always prints the same paper, and different battles read differently.

const hash = (i: PressIssue) => Math.abs(Math.floor(i.at / 1000)) % 3;

function mainHeadline(i: PressIssue): string {
  if (i.race) return raceHeadline(i);
  if (i.science) return scienceHeadline(i);
  if (i.operation) {
    const code = i.operation.codename.toUpperCase();
    const site = i.operation.site.toUpperCase();
    return i.operation.outcome === 'victory'
      ? [`ENEMY OPERATION ${code} TAKES ${site}`, `${site} LOST IN ${code} RAID`, `${code} BREAKS THE LINE AT ${site}`][hash(i)]
      : [`OPERATION ${code} REPULSED`, `${site} HOLDS AGAINST ${code}`, `${code} FORCE TURNED BACK`][hash(i)];
  }
  if (i.frontName) {
    const f = i.frontName.toUpperCase();
    if ((i.controlDelta ?? 0) > 0) {
      return [`${f} CHANGES HANDS`, `BREAKTHROUGH AT ${f}`, `${f} FALLS TO THE PUSH`][hash(i)];
    }
    if ((i.controlDelta ?? 0) < 0) {
      return [`${f} SLIPS AWAY`, `SETBACK AT ${f}`, `${f} COSTS US DEAR`][hash(i)];
    }
    return [`STALEMATE GRINDS ON AT ${f}`, `${f} HOLDS ITS BREATH`, `NO GROUND GIVEN AT ${f}`][hash(i)];
  }
  return i.won
    ? ['THE FIELD IS OURS', 'VICTORY IN THE OPEN', 'THE LINE HELD'][hash(i)]
    : ['A HARD DAY AT THE FRONT', 'THE LINE BENDS', 'THEY TOOK THE FIELD'][hash(i)];
}

/** THE SPORTS PAGE headline — a race the way a paper would run it. */
export function raceHeadline(issue: PressIssue): string {
  const r = issue.race;
  if (!r) return 'RACE RESULT';
  const who = r.winner.toUpperCase();
  const cls = r.cls.toUpperCase();
  if (r.recordTaken) {
    return r.previousHolder
      ? [`${who} SHATTERS THE ${cls} RECORD`, `RECORD FALLS: ${who} TAKES IT FROM ${r.previousHolder.toUpperCase()}`, `${who} REWRITES THE ${cls} BOOK`][hash(issue)]
      : [`${who} SETS THE ${cls} MARK`, `FIRST BLOOD: ${who} OWNS THE ${cls} RECORD`, `${who} STAMPS THE FIRST ${cls} TIME`][hash(issue)];
  }
  return [`${who} TAKES THE ${cls} FEATURE`, `${who} WINS AT ${r.venue.toUpperCase()}`, `${cls} HONOURS TO ${who}`][hash(issue)];
}

export function scienceHeadline(issue: PressIssue): string {
  if (!issue.science) return mainHeadline({ ...issue, science: undefined });
  return `OPERATION ${issue.science.id} — ${issue.won ? 'PACKAGE SECURED' : 'PRINT STOCK LOST'}`;
}

function duelLead(i: PressIssue): string {
  const shot = i.longestShot > 0 ? ` The talk of the trenches: a ${i.longestShot}u shot nobody saw coming.` : '';
  return `${i.aceName} led the killing with ${i.aceKills} confirmed.${shot}`;
}

function moneyLead(i: PressIssue): string {
  if (i.underdog) {
    return `Won on ${i.myCost} against their ${i.theirCost}. The quartermaster calls it impossible; the men call it Tuesday. Morale rises${i.morale ? ` to ${i.morale}` : ''}.`;
  }
  if (i.myCost > i.theirCost && i.won) {
    return `Victory, but the books bleed: ${i.myCost} spent against their ${i.theirCost}. The stable wants receipts.`;
  }
  return `The bill: ours ${i.myCost}, theirs ${i.theirCost}. War is bought by the pound.`;
}

function fieldLead(i: PressIssue): string {
  const score = `${i.myKills}–${i.theirKills}`;
  const medals = i.medals.length ? ` Decorations issued: ${i.medals.join(', ')}.` : '';
  return `${i.modeName} closed ${score}.${medals}`;
}

function operationLead(i: PressIssue): string | null {
  const op = i.operation;
  if (!op) return null;
  const result = op.outcome === 'victory' ? 'The enemy completed' : 'Our defenders stopped';
  const ace = op.aceHull ? ` Their leading hull was ${op.aceHull}.` : '';
  const reward = op.reward ? ` Strategic consequence: ${op.reward}.` : '';
  return `${result} ${op.objectivesCompleted} of ${op.objectivesTotal} objectives at ${op.site}; ${op.hullsLost} committed hull${op.hullsLost === 1 ? '' : 's'} lost.${ace}${reward}`;
}

// ── the corrections desk (W4.3) ────────────────────────────────────────────
// A real paper corrects itself. Each edition runs ONE small correction about
// the PREVIOUS issue — grounded in that issue's actual data, picked by the
// same stable hash so the same pair of battles always prints the same
// retraction. The Courier regrets the error. The Courier regrets most things.

export function correctionLine(prev: PressIssue | undefined, cur: PressIssue): string | null {
  if (!prev) return null;
  const pool: string[] = [];
  if (prev.longestShot > 0) {
    pool.push(`The ${prev.longestShot}u shot reported in our last edition has been re-measured by the survey office at ${Math.max(1, prev.longestShot - 1)}u. The Courier regrets the yard.`);
  }
  if (prev.aceKills > 0) {
    pool.push(`${prev.aceName} writes to claim ${prev.aceKills + 1} confirmed, not the ${prev.aceKills} we printed. The desk stands by its count and invites ${prev.aceName} to shoot straighter.`);
  }
  if (prev.underdog) {
    pool.push(`Our last edition called the ${prev.myCost}-against-${prev.theirCost} victory "impossible." The quartermaster has completed his review: it remains impossible. It also remains a victory.`);
  }
  if (prev.frontName && cur.frontName === prev.frontName && (prev.controlDelta ?? 0) > 0 && (cur.controlDelta ?? 0) < 0) {
    pool.push(`"${prev.frontName.toUpperCase()} CHANGES HANDS," we reported. It has changed hands again. The Courier will stop reporting on ${prev.frontName} until it makes up its mind.`);
  }
  if (!pool.length) {
    pool.push('No factual errors were found in our previous edition. The Courier apologizes for the inconvenience.');
  }
  return pool[hash(cur) % pool.length];
}

// ── the pressroom ───────────────────────────────────────────────────────────

export const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

/** One full front page. `prev` feeds the corrections desk (W4.3). */
export function renderIssueHTML(i: PressIssue, prev?: PressIssue): string {
  const correction = correctionLine(prev, i);
  const date = new Date(i.at);
  const dateline = `Season ${i.season} · ${date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}`;
  const control = i.frontName && i.controlAfter !== undefined
    ? `<div class="np-control"><span>FRONT CONTROL</span><b>${i.controlAfter > 0 ? '+' : ''}${i.controlAfter}</b>${i.controlDelta ? `<em>(${i.controlDelta > 0 ? '+' : ''}${i.controlDelta} this battle)</em>` : ''}</div>`
    : '';
  const science = i.science;
  const columns = science
    ? `<div class="np-columns np-science-columns">
      <section><h3>THE OPERATION</h3><p>${esc(science.briefing)}</p></section>
      <section><h3>CLONES SPENT</h3><p>${science.clonesSpent} sleeves burned. ${science.clonesRemaining} viable prints returned to the front.</p></section>
      <section><h3>THE PRIZE</h3><p><b>${esc(scienceReward(science.reward).label.toUpperCase())}</b> — ${esc(scienceReward(science.reward).description)}</p></section>
    </div>`
    : `<div class="np-columns">
      <section><h3>THE DUEL</h3><p>${esc(duelLead(i))}</p></section>
      <section><h3>THE LEDGER</h3><p>${esc(moneyLead(i))}</p></section>
      <section><h3>THE FIELD</h3><p>${esc(fieldLead(i))}</p></section>
    </div>`;
  const operation = operationLead(i);
  return `
  <article class="np-paper${i.won ? '' : ' np-lost'}">
    <header class="np-masthead">
      <div class="np-ears"><span>ONE SHELL</span><span>FINAL EDITION</span></div>
      <h1>The Front Courier</h1>
      <div class="np-dateline"><span>${esc(dateline)}</span><span>ALL THE FRONTS · ALL THE FACTS</span></div>
    </header>
    <h2 class="np-headline">${esc(mainHeadline(i))}</h2>
    ${control}
    ${operation ? `<div class="np-operation"><span>ENEMY ACTION REPORT</span><p>${esc(operation)}</p></div>` : ''}
    ${columns}
    ${science?.ghost ? '<div class="np-banner">★ GHOST RUN — NO ALARM RAISED ★</div>' : i.underdog ? '<div class="np-banner">★ UNDERFUNDED VICTORY — MORALE RISES ★</div>' : ''}
    ${correction ? `<div class="np-corrections"><h4>CORRECTIONS</h4><p>${esc(correction)}</p></div>` : ''}
  </article>`;
}

/** The press archive: newest full page, older issues as a headline stack. */
export function renderPressInto(root: HTMLElement) {
  const issues = loadPress();
  if (!issues.length) {
    root.innerHTML = '<p class="opt">THE FRONT COURIER — the first battle files the first issue.</p>';
    return;
  }
  const [latest, ...older] = issues;
  const stack = older.length
    ? `<div class="np-stack"><h4>THE ARCHIVE</h4>${older.map((i) =>
      `<div class="np-clip"><span class="np-clip-date">${new Date(i.at).toLocaleDateString()}</span><b>${esc(mainHeadline(i))}</b></div>`).join('')}</div>`
    : '';
  root.innerHTML = `${renderIssueHTML(latest, older[0])}${stack}`;
}
