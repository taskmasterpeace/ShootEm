import fs from 'fs';

const DIR = 'D:/git/COF/canon/countries';
const OUT = process.argv[2] || 'D:/git/ShootEM/src/data/nations.ts';

function parseCSV(t) {
  const rows = [];
  let f = '', row = [], q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) {
      if (c === '"') { if (t[i + 1] === '"') { f += '"'; i++; } else q = false; }
      else f += c;
    } else {
      if (c === '"') q = true;
      else if (c === ',') { row.push(f); f = ''; }
      else if (c === '\n') { row.push(f); rows.push(row); row = []; f = ''; }
      else if (c === '\r') { /* skip */ }
      else f += c;
    }
  }
  if (f.length || row.length) { row.push(f); rows.push(row); }
  return rows;
}

// Real-world country name -> ISO 3166-1 alpha-2, for emoji flags.
const ISO2 = {
  'Kyrgyzstan':'KG','Uruguay':'UY','Fiji':'FJ','Belize':'BZ','The Bahamas':'BS','Montenegro':'ME',
  'Andorra':'AD','Monaco':'MC','Slovenia':'SI','Norway':'NO','North Macedonia':'MK','Slovakia':'SK',
  'Austria':'AT','Moldova':'MD','Albania':'AL','Bulgaria':'BG','Bosnia and Herzegovina':'BA','Estonia':'EE',
  'Brunei':'BN','Uganda':'UG','Solomon Islands':'SB','Papua New Guinea':'PG','Suriname':'SR','Guyana':'GY',
  'Equatorial Guinea':'GQ','São Tomé and Príncipe':'ST','Eswatini':'SZ','Botswana':'BW','Western Sahara':'EH',
  'Central African Republic':'CF','South Sudan':'SS','Namibia':'NA','Mauritania':'MR','Turkmenistan':'TM',
  'Trinidad and Tobago':'TT','Togo':'TG','Serbia':'RS','Paraguay':'PY','Panama':'PA','Palestine':'PS',
  'Oman':'OM','Nicaragua':'NI','New Zealand':'NZ','Nepal':'NP','Mali':'ML','Malawi':'MW','Madagascar':'MG',
  'Lithuania':'LT','Latvia':'LV','Laos':'LA','Iceland':'IS','Hungary':'HU','Haiti':'HT','Guinea-Bissau':'GW',
  'Guatemala':'GT','Georgia':'GE','Gabon':'GA','Finland':'FI','Eritrea':'ER','El Salvador':'SV','Ecuador':'EC',
  'Dominican Republic':'DO','Djibouti':'DJ','Denmark':'DK','Czech Republic':'CZ','Cuba':'CU','Costa Rica':'CR',
  'Cambodia':'KH','Cameroon':'CM','Burundi':'BI','Burkina Faso':'BF','Tunisia':'TN','Chile':'CL','Chad':'TD',
  'Afghanistan':'AF','Honduras':'HN','Guinea':'GN','Greece':'GR','Hong Kong':'HK','Niger':'NE','Myanmar':'MM',
  'Netherlands':'NL','Lebanon':'LB','Liberia':'LR','Kuwait':'KW','Kenya':'KE','Jordan':'JO','Kazakhstan':'KZ',
  'Libya':'LY','Malaysia':'MY','Romania':'RO','Qatar':'QA','Portugal':'PT','Poland':'PL','Puerto Rico':'PR',
  'Republic of the Congo':'CG','Zimbabwe':'ZW','Zambia':'ZM','Yemen':'YE','Vietnam':'VN','Venezuela':'VE',
  'United States':'US','United Kingdom':'GB','United Arab Emirates':'AE','Ukraine':'UA','Turkey':'TR',
  'Thailand':'TH','Tanzania':'TZ','Tajikistan':'TJ','Taiwan':'TW','Syria':'SY','Switzerland':'CH','Sweden':'SE',
  'Sudan':'SD','Sri Lanka':'LK','Spain':'ES','South Korea':'KR','South Africa':'ZA','Somalia':'SO','Singapore':'SG',
  'Sierra Leone':'SL','Senegal':'SN','Saudi Arabia':'SA','Rwanda':'RW','Russia':'RU','Philippines':'PH','Peru':'PE',
  'Pakistan':'PK','North Korea':'KP','Nigeria':'NG','Mozambique':'MZ','Morocco':'MA','Mongolia':'MN','Mexico':'MX',
  'Japan':'JP','Jamaica':'JM','China':'CN','Ivory Coast':'CI','Italy':'IT','Israel':'IL','Ireland':'IE','Iraq':'IQ',
  'Iran':'IR','Indonesia':'ID','India':'IN','Ghana':'GH','Germany':'DE','France':'FR','Ethiopia':'ET','Egypt':'EG',
  'Congo':'CD','Colombia':'CO','Uzbekistan':'UZ','Canada':'CA','Brazil':'BR','Bolivia':'BO','Benin':'BJ',
  'Belgium':'BE','Belarus':'BY','Bangladesh':'BD','Bahrain':'BH','Azerbaijan':'AZ','Croatia':'HR','Australia':'AU',
  'Armenia':'AM','Argentina':'AR','Angola':'AO','Algeria':'DZ',
};

function flagOf(iso2) {
  if (!iso2 || iso2.length !== 2) return '🏳️'; // white flag fallback
  return [...iso2.toUpperCase()].map(c => String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65)).join('');
}

const num = (v) => { const n = parseFloat(String(v).trim()); return isFinite(n) ? n : 0; };

// Cloning & LSWRegulations are CATEGORICAL in the sheet ("Banned"/"Regulated"/
// "Legal"). Map to a 0–100 doctrine proxy for the derivation; the display keeps
// the words.
const CLONE_SCORE = { legal: 100, regulated: 55, banned: 0, inactive: 0 };
const LSW_LOOSENESS = { legal: 100, regulated: 50, banned: 0, inactive: 20 };
const scoreOf = (table, s) => table[String(s).trim().toLowerCase()] ?? 30;

// ── FACTION DERIVATION (the game's law: derived, never transcribed) ──────────
// A single MACHINE-DOCTRINE index per nation: unregulated LSW activity, legal
// cloning (it prints bodies), loose LSW law and high science pull toward the
// machine pole; a conventional military/intelligence budget pulls toward
// combined arms. The roster splits at its own MEDIAN so both factions field a
// full stable of nations (the lore: "both sides field a full stable today").
// The Collective built the living super weapons; the United Front regulates
// them and fights with K9s. Boundary nations are genuinely mixed — either way
// is defensible. Retune the weights here, never the emitted data.
function machineIndex(c) {
  const cloneScore = scoreOf(CLONE_SCORE, c.cloning);
  const lswLoose = scoreOf(LSW_LOOSENESS, c.lswReg);
  return 1.0 * c.lswActivity + 0.9 * cloneScore + 0.55 * lswLoose + 0.45 * c.science
       - 1.2 * c.military - 0.7 * c.intel;
}

// ── parse countries ──────────────────────────────────────────────────────────
const cRows = parseCSV(fs.readFileSync(`${DIR}/Country Master Sheet - Country.csv`, 'utf8'));
const H = cRows[0].map(h => h.trim());
const col = (name) => H.indexOf(name);
const iCode=col('Country Code'), iName=col('Country'), iPop=col('Population'), iMotto=col('Motto'),
  iNat=col('Nationalities'), iGov=col('GovernmentStructureType'), iPerc=col('GovernmentPreception'),
  iMil=col('MilitaryBudget'), iIntel=col('IntelligenceBudget'), iSci=col('Science'), iClone=col('Cloning'),
  iLsw=col('LSWActivity'), iLswReg=col('LSWRegulations'), iTitle=col('LeaderTitleType'), iPres=col('President');

const countries = cRows.slice(2).filter(r => r[iName] && r[iName].trim()).map(r => {
  const name = r[iName].trim();
  const c = {
    code: parseInt(r[iCode], 10) || 0,
    name,
    iso2: ISO2[name] || '',
    flag: flagOf(ISO2[name]),
    population: num(r[iPop]),
    motto: (r[iMotto] || '').trim(),
    nationality: (r[iNat] || '').trim().split(/[,/]/)[0].trim() || name,  // a few sheet rows omit the demonym
    government: (r[iGov] || '').trim(),
    perception: (r[iPerc] || '').trim(),
    leaderTitle: (r[iTitle] || 'President').trim(),
    president: (r[iPres] || '').trim(),
    military: num(r[iMil]), intel: num(r[iIntel]), science: num(r[iSci]),
    lswActivity: num(r[iLsw]),
    cloning: (r[iClone] || '').trim(),   // categorical, kept as words for display
    lswReg: (r[iLswReg] || '').trim(),
  };
  c.mi = machineIndex(c);
  return c;
});

// median split → both factions get a full stable of nations
const sortedMi = countries.map(c => c.mi).sort((a, b) => a - b);
const medianMi = sortedMi[Math.floor(sortedMi.length / 2)];
for (const c of countries) {
  // ties resolve toward the Front so the split can't exceed half by rounding
  c.faction = c.mi > medianMi ? 'collective' : 'united_front';
}

// ── validate the parse against the shipped map dataset (no drift) ─────────────
try {
  const mapCountries = JSON.parse(fs.readFileSync('D:/git/ShootEM/src/data/map-countries.json', 'utf8'));
  const byCode = new Map(mapCountries.map(m => [String(m.code), m]));
  let checked = 0, mism = [];
  for (const c of countries) {
    const m = byCode.get(String(c.code));
    if (!m) continue;
    checked++;
    if (m.science !== c.science) mism.push(`${c.name}: science ${c.science} vs map ${m.science}`);
    if (m.lswActivity !== c.lswActivity) mism.push(`${c.name}: lswAct ${c.lswActivity} vs map ${m.lswActivity}`);
  }
  console.error(`validate vs map-countries.json: ${checked} matched by code, ${mism.length} field mismatches` +
    (mism.length ? '\n    ' + mism.slice(0, 10).join('\n    ') : ' ✓'));
} catch (e) { console.error('validate skipped:', e.message); }

// ── report the split before emit ─────────────────────────────────────────────
const coll = countries.filter(c => c.faction === 'collective');
const front = countries.filter(c => c.faction === 'united_front');
const noIso = countries.filter(c => !c.iso2);
console.error(`countries: ${countries.length}   (median machine-index ${medianMi.toFixed(1)})`);
console.error(`  The Collective:   ${coll.length}`);
console.error(`  The United Front: ${front.length}`);
console.error(`  missing ISO2: ${noIso.length}${noIso.length ? ' -> ' + noIso.map(c=>c.name).join(', ') : ''}`);
console.error(`  sample Collective:   ${coll.slice(0,10).map(c=>c.flag+' '+c.name).join(', ')}`);
console.error(`  sample United Front: ${front.slice(0,10).map(c=>c.flag+' '+c.name).join(', ')}`);
console.error(`  big powers: ` + ['United States','Russia','China','Germany','Japan','United Kingdom','France','Israel','North Korea','Switzerland','South Korea','Iran'].map(n=>{const c=countries.find(x=>x.name===n);return c?`${c.name.split(' ')[0]}=${c.faction==='collective'?'COL':'UF'}`:n+'?';}).join(' '));

// ── emit ─────────────────────────────────────────────────────────────────────
const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
const lines = [];
lines.push('// AUTO-GENERATED from the Consequences of Failure Country Master Sheet');
lines.push('// (D:/git/COF/canon/countries/*.csv). Do not hand-edit — regenerate with');
lines.push('// tools/gen-nations.mjs. Lean identity slice for character onboarding only;');
lines.push('// the full coalition-matchmaking layer is AGENT-1 territory (docs/META-LAYER.md §C).');
lines.push('//');
lines.push('// FACTION is DERIVED from each nation\'s own doctrine stats (the game law:');
lines.push('// "derived, never transcribed") — unregulated LSW + cloning + science lean');
lines.push('// The Collective (machine doctrine); military + LSW regulation lean The United');
lines.push('// Front (combined arms). Retune deriveFaction() in the generator, never here.');
lines.push('');
lines.push("export type NationFaction = 'united_front' | 'collective';");
lines.push('');
lines.push('export interface Nation {');
lines.push('  /** Canonical Country Code from the master sheet. */');
lines.push('  code: number;');
lines.push('  name: string;');
lines.push('  /** ISO 3166-1 alpha-2, for the emoji flag. */');
lines.push('  iso2: string;');
lines.push('  /** Emoji flag (regional-indicator pair). */');
lines.push('  flag: string;');
lines.push('  population: number;');
lines.push('  motto: string;');
lines.push('  /** Demonym for the enlistee ("Uruguayan"). */');
lines.push('  nationality: string;');
lines.push('  government: string;');
lines.push('  perception: string;');
lines.push('  leaderTitle: string;');
lines.push('  president: string;');
lines.push('  /** The faction this nation fights for, DERIVED from its doctrine stats. */');
lines.push('  faction: NationFaction;');
lines.push('  /** Doctrine stats (0–100) that drove the derivation and tint what the nation sends. */');
lines.push('  military: number;');
lines.push('  intel: number;');
lines.push('  science: number;');
lines.push('  lswActivity: number;');
lines.push("  /** Cloning policy, as the sheet's words: 'Banned' | 'Regulated' | 'Legal'. */");
lines.push('  cloning: string;');
lines.push("  /** LSW regulation, as the sheet's words. */");
lines.push('  lswReg: string;');
lines.push('}');
lines.push('');
lines.push('export const NATIONS: Nation[] = [');
for (const c of countries.sort((a, b) => a.name.localeCompare(b.name))) {
  lines.push(`  { code: ${c.code}, name: '${esc(c.name)}', iso2: '${c.iso2}', flag: '${c.flag}', population: ${c.population}, motto: '${esc(c.motto)}', nationality: '${esc(c.nationality)}', government: '${esc(c.government)}', perception: '${esc(c.perception)}', leaderTitle: '${esc(c.leaderTitle)}', president: '${esc(c.president)}', faction: '${c.faction}', military: ${c.military}, intel: ${c.intel}, science: ${c.science}, lswActivity: ${c.lswActivity}, cloning: '${esc(c.cloning)}', lswReg: '${esc(c.lswReg)}' },`);
}
lines.push('];');
lines.push('');
lines.push('export const NATIONS_BY_CODE: Record<number, Nation> = Object.fromEntries(NATIONS.map(n => [n.code, n]));');
lines.push('');
fs.writeFileSync(OUT, lines.join('\n'), 'utf8');
console.error(`\nwrote ${OUT} (${countries.length} nations)`);
