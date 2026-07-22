import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  evaluateFoundationMatrix,
  evaluateRotorcraftMatrix,
  runFoundationMatrix,
  runRotorcraftMatrix,
  type FoundationMatrixReport,
  type FoundationMatrixVerdict,
  type RotorcraftMatrixReport,
  type VehicleScenarioKind,
} from '../src/sim/scenario-runner';

const SEEDS = [7, 31, 42, 99, 4207, 5150, 7749, 1337, 90210, 606];
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = resolve(root, 'docs/reference/vehicle-theaters');

function countByKind(report: FoundationMatrixReport): Record<VehicleScenarioKind, number> {
  const counts: Record<VehicleScenarioKind, number> = {
    route: 0, fixed_wing: 0, ground_duel: 0, naval: 0, combined_arms: 0,
  };
  for (const scenario of report.scenarios) counts[scenario.kind]++;
  return counts;
}

function failures(verdict: FoundationMatrixVerdict): string[] {
  return [
    ...verdict.structuralFailures,
    ...verdict.routeFailures,
    ...verdict.contactFailures,
    ...(!Number.isFinite(verdict.fixedWingFirstContact.min) || verdict.fixedWingFirstContact.min < 8
      ? [`fixed-wing first contact minimum ${verdict.fixedWingFirstContact.min}s is below 8s`] : []),
    ...(!Number.isFinite(verdict.fixedWingFirstContact.max) || verdict.fixedWingFirstContact.max > 45
      ? [`fixed-wing first contact maximum ${verdict.fixedWingFirstContact.max}s exceeds 45s`] : []),
    ...(!Number.isFinite(verdict.groundNavalFirstContact.min) || verdict.groundNavalFirstContact.min < 20
      ? [`ground/naval first contact minimum ${verdict.groundNavalFirstContact.min}s is below 20s`] : []),
    ...(!Number.isFinite(verdict.groundNavalFirstContact.max) || verdict.groundNavalFirstContact.max > 120
      ? [`ground/naval first contact maximum ${verdict.groundNavalFirstContact.max}s exceeds 120s`] : []),
    ...(verdict.maxMirroredWinRate > 0.7
      ? [`mirrored side win rate ${(verdict.maxMirroredWinRate * 100).toFixed(1)}% exceeds 70%`] : []),
  ];
}

function markdown(report: FoundationMatrixReport, verdict: FoundationMatrixVerdict, errors: string[]): string {
  const counts = countByKind(report);
  const lines = [
    '# Vehicle Theater Foundation Report',
    '',
    `Status: **${errors.length === 0 ? 'PASS' : 'FAIL'}**`,
    '',
    `Deterministic seeds: ${report.seeds.join(', ')}`,
    '',
    '| Scenario | Runs |',
    '| --- | ---: |',
    ...Object.entries(counts).map(([kind, count]) => `| ${kind.replaceAll('_', ' ')} | ${count} |`),
    `| **total** | **${report.scenarios.length}** |`,
    '',
    '## Acceptance evidence',
    '',
    '| Gate | Result | Required |',
    '| --- | ---: | ---: |',
    `| Structural violations | ${verdict.structuralFailures.length} | 0 |`,
    `| Route failures | ${verdict.routeFailures.length} | 0 |`,
    `| Engagements without contact | ${verdict.contactFailures.length} | 0 |`,
    `| Fixed-wing first contact | ${verdict.fixedWingFirstContact.min}-${verdict.fixedWingFirstContact.max}s | 8-45s |`,
    `| Ground/naval first contact | ${verdict.groundNavalFirstContact.min}-${verdict.groundNavalFirstContact.max}s | 20-120s |`,
    `| Maximum mirrored side win rate | ${(verdict.maxMirroredWinRate * 100).toFixed(1)}% | <=70% |`,
    '',
    'The matrix advances the real simulation at 20 Hz. It uses authored theater routes, bot vehicle control, weapon collisions, and the production telemetry recorder; it is not a mocked combat model.',
    '',
  ];
  if (errors.length) lines.push('## Failures', '', ...errors.map((error) => `- ${error}`), '');
  return `${lines.join('\n')}\n`;
}

function rotorcraftMarkdown(report: RotorcraftMatrixReport, insertionFailures: string[], supportFailures: string[]): string {
  const contacts = report.support.flatMap((row) => row.firstContact === null ? [] : [row.firstContact]);
  const errors = [...insertionFailures, ...supportFailures];
  const lines = [
    '# Military Rotorcraft Report',
    '',
    `Status: **${errors.length === 0 ? 'PASS' : 'FAIL'}**`,
    '',
    `Deterministic seeds: ${report.seeds.join(', ')}`,
    '',
    '| Gate | Result | Required |',
    '| --- | ---: | ---: |',
    `| Condor insertion runs | ${report.insertions.length} | 50 |`,
    `| Shrike support runs | ${report.support.length} | 50 |`,
    `| Insertion failures | ${insertionFailures.length} | 0 |`,
    `| Support failures | ${supportFailures.length} | 0 |`,
    `| Shrike first contact | ${Math.min(...contacts)}-${Math.max(...contacts)}s | every run |`,
    '',
    'Condors fly authored theater approaches, descend through the shared elevation bands, and land inside compatible LZs. Shrikes use the production vehicle AI and weapons against live armored targets; damage and explosive hits come from the shared telemetry recorder.',
    '',
  ];
  if (errors.length) lines.push('## Failures', '', ...errors.map((error) => `- ${error}`), '');
  return `${lines.join('\n')}\n`;
}

const report = runFoundationMatrix({ seeds: SEEDS });
const verdict = evaluateFoundationMatrix(report);
const foundationErrors = failures(verdict);
const rotorcraft = runRotorcraftMatrix({ seeds: SEEDS });
const rotorcraftVerdict = evaluateRotorcraftMatrix(rotorcraft);
const rotorcraftErrors = [...rotorcraftVerdict.insertionFailures, ...rotorcraftVerdict.supportFailures];
mkdirSync(outputDir, { recursive: true });
writeFileSync(resolve(outputDir, 'foundation-report.json'), `${JSON.stringify({ report, verdict }, null, 2)}\n`);
writeFileSync(resolve(outputDir, 'foundation-report.md'), markdown(report, verdict, foundationErrors));
writeFileSync(resolve(outputDir, 'rotorcraft-report.json'), `${JSON.stringify({ report: rotorcraft, verdict: rotorcraftVerdict }, null, 2)}\n`);
writeFileSync(resolve(outputDir, 'rotorcraft-report.md'), rotorcraftMarkdown(rotorcraft, rotorcraftVerdict.insertionFailures, rotorcraftVerdict.supportFailures));

console.log(`Vehicle theater matrix: ${foundationErrors.length === 0 ? 'PASS' : 'FAIL'} (${report.scenarios.length} scenarios)`);
console.log(`Fixed-wing contact ${verdict.fixedWingFirstContact.min}-${verdict.fixedWingFirstContact.max}s; ground/naval ${verdict.groundNavalFirstContact.min}-${verdict.groundNavalFirstContact.max}s`);
console.log(`Mirrored side win ceiling ${(verdict.maxMirroredWinRate * 100).toFixed(1)}%`);
console.log(`Rotorcraft matrix: ${rotorcraftErrors.length === 0 ? 'PASS' : 'FAIL'} (${rotorcraft.insertions.length + rotorcraft.support.length} scenarios)`);
for (const error of [...foundationErrors, ...rotorcraftErrors]) console.error(`- ${error}`);
if (foundationErrors.length || rotorcraftErrors.length) process.exitCode = 1;
