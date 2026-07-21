import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  evaluateFoundationMatrix,
  runFoundationMatrix,
  type FoundationMatrixReport,
  type FoundationMatrixVerdict,
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

const report = runFoundationMatrix({ seeds: SEEDS });
const verdict = evaluateFoundationMatrix(report);
const errors = failures(verdict);
mkdirSync(outputDir, { recursive: true });
writeFileSync(resolve(outputDir, 'foundation-report.json'), `${JSON.stringify({ report, verdict }, null, 2)}\n`);
writeFileSync(resolve(outputDir, 'foundation-report.md'), markdown(report, verdict, errors));

console.log(`Vehicle theater matrix: ${errors.length === 0 ? 'PASS' : 'FAIL'} (${report.scenarios.length} scenarios)`);
console.log(`Fixed-wing contact ${verdict.fixedWingFirstContact.min}-${verdict.fixedWingFirstContact.max}s; ground/naval ${verdict.groundNavalFirstContact.min}-${verdict.groundNavalFirstContact.max}s`);
console.log(`Mirrored side win ceiling ${(verdict.maxMirroredWinRate * 100).toFixed(1)}%`);
for (const error of errors) console.error(`- ${error}`);
if (errors.length) process.exitCode = 1;
