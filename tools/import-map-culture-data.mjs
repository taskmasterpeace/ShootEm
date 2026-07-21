#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const argv = new Map();
for (let i = 2; i < process.argv.length; i += 2) argv.set(process.argv[i], process.argv[i + 1]);
const countryPath = argv.get('--countries');
const cityPath = argv.get('--cities');
const outputPath = argv.get('--out');
if (!countryPath || !cityPath || !outputPath) {
  throw new Error('usage: node tools/import-map-culture-data.mjs --countries <country.csv> --cities <cities.csv> --out <dir>');
}

function parseCsv(source) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (quoted) {
      if (ch === '"' && source[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n') {
      row.push(cell.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell.length || row.length) { row.push(cell.replace(/\r$/, '')); rows.push(row); }
  const keys = rows.shift().map((key) => key.trim());
  return rows.map((values) => Object.fromEntries(keys.map((key, index) => [key, (values[index] ?? '').trim()])));
}

const number = (value, fallback = 0) => {
  const parsed = Number(String(value ?? '').replaceAll(',', '').trim());
  return Number.isFinite(parsed) ? parsed : fallback;
};
const slug = (value) => value.toLowerCase().normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const countryAlias = new Map([
  ['dr congo', 'congo'],
]);
const normalizedCountryName = (value) => {
  const name = value.trim().replace(/\s+/g, ' ');
  return countryAlias.get(name.toLowerCase()) ?? name.toLowerCase();
};

const countryRows = parseCsv(await readFile(resolve(countryPath), 'utf8'));
const countries = countryRows
  .filter((row) => /^\d+$/.test(row['Country Code']))
  .map((row) => ({
    code: row['Country Code'],
    name: row.Country,
    government: row.GovernmentStructureType,
    governmentPerception: row.GovernmentPreception,
    corruption: number(row.GovermentCorruption),
    military: number(row.MilitaryServices),
    militaryBudget: number(row.MilitaryBudget),
    lawEnforcement: number(row.LawEnforcement),
    lawEnforcementBudget: number(row.LawEnforcementBudget),
    science: number(row.Science),
    digital: number(row.DigitalDevelopment),
    cloning: row.Cloning,
    lswActivity: number(row.LSWActivity),
    lswRegulations: row.LSWRegulations,
    lifestyle: number(row.Lifestyle),
    leaderTitle: row.LeaderTitleType,
  }))
  .sort((a, b) => Number(a.code) - Number(b.code));

const countriesByName = new Map(countries.map((country) => [normalizedCountryName(country.name), country]));
const allowedTags = new Set(['Company', 'Educational', 'Industrial', 'Military', 'Mining', 'Political', 'Resort', 'Seaport', 'Temple']);
const cityRows = parseCsv(await readFile(resolve(cityPath), 'utf8'))
  .filter((row) => row.CityName && row.CityName !== 'Name of city' && row.CityName !== 'CityName');
const missing = [];
const cities = cityRows.map((row) => {
  const country = countriesByName.get(normalizedCountryName(row.Country));
  if (!country) { missing.push(`${row.CityName} (${row.Country})`); return null; }
  const population = Math.round(number(row.Population));
  const tags = ['CityType1', 'CityType2', 'CityType3', 'CityType4']
    .map((key) => row[key]).filter((tag) => allowedTags.has(tag));
  const populationType = row.PopulationType.trim().replace(/\s+/g, ' ');
  const sector = row.Sector;
  return {
    id: `${country.code}:${slug(row.CityName)}:${sector ? slug(sector) : 'none'}:${population}`,
    sector,
    countryCode: country.code,
    cultureCode: /^\d+$/.test(row.CultureCode) ? number(row.CultureCode) : null,
    name: row.CityName,
    country: country.name,
    population,
    populationRating: number(row.PopulationRating),
    populationType,
    tags,
    crime: number(row.CrimeIndex, 50),
    safety: number(row.SafetyIndex, 50),
  };
}).filter(Boolean).sort((a, b) => Number(a.countryCode) - Number(b.countryCode) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));

if (missing.length) throw new Error(`missing country joins (${missing.length}): ${missing.join(', ')}`);
if (new Set(countries.map((country) => country.code)).size !== countries.length) throw new Error('duplicate country code');
if (new Set(cities.map((city) => city.id)).size !== cities.length) throw new Error('duplicate city id');

await mkdir(resolve(outputPath), { recursive: true });
await Promise.all([
  writeFile(resolve(outputPath, 'map-countries.json'), `${JSON.stringify(countries, null, 2)}\n`),
  writeFile(resolve(outputPath, 'map-cities.json'), `${JSON.stringify(cities, null, 2)}\n`),
]);
process.stdout.write(`${countries.length} countries; ${cities.length} cities; ${missing.length} missing country joins\n`);
