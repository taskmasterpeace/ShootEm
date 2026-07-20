// ---------------------------------------------------------------------------
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

// ── the pressroom ───────────────────────────────────────────────────────────

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

/** One full front page. */
export function renderIssueHTML(i: PressIssue): string {
  const date = new Date(i.at);
  const dateline = `Season ${i.season} · ${date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}`;
  const control = i.frontName && i.controlAfter !== undefined
    ? `<div class="np-control"><span>FRONT CONTROL</span><b>${i.controlAfter > 0 ? '+' : ''}${i.controlAfter}</b>${i.controlDelta ? `<em>(${i.controlDelta > 0 ? '+' : ''}${i.controlDelta} this battle)</em>` : ''}</div>`
    : '';
  return `
  <article class="np-paper${i.won ? '' : ' np-lost'}">
    <header class="np-masthead">
      <div class="np-ears"><span>ONE SHELL</span><span>FINAL EDITION</span></div>
      <h1>The Front Courier</h1>
      <div class="np-dateline"><span>${esc(dateline)}</span><span>ALL THE FRONTS · ALL THE FACTS</span></div>
    </header>
    <h2 class="np-headline">${esc(mainHeadline(i))}</h2>
    ${control}
    <div class="np-columns">
      <section><h3>THE DUEL</h3><p>${esc(duelLead(i))}</p></section>
      <section><h3>THE LEDGER</h3><p>${esc(moneyLead(i))}</p></section>
      <section><h3>THE FIELD</h3><p>${esc(fieldLead(i))}</p></section>
    </div>
    ${i.underdog ? '<div class="np-banner">★ UNDERFUNDED VICTORY — MORALE RISES ★</div>' : ''}
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
  root.innerHTML = `${renderIssueHTML(latest)}${stack}`;
}
