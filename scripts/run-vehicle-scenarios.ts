import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  evaluateFoundationMatrix,
  evaluateRotorcraftMatrix,
  evaluateSubmarineMatrix,
  runFoundationMatrix,
  runRotorcraftMatrix,
  runSubmarineMatrix,
  type FoundationMatrixReport,
  type FoundationMatrixVerdict,
  type RotorcraftMatrixReport,
  type SubmarineMatrixReport,
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
  const radar = report.scenarios.reduce((sum, row) => ({
    sweeps: sum.sweeps + row.telemetry.radarSweeps,
    contacts: sum.contacts + row.telemetry.radarContacts,
    jammed: sum.jammed + row.telemetry.radarJammed,
    reacquired: sum.reacquired + row.telemetry.radarReacquired,
  }), { sweeps: 0, contacts: 0, jammed: 0, reacquired: 0 });
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
    `| Radar sweeps / contacts | ${radar.sweeps} / ${radar.contacts} | >0 / >0 |`,
    `| Jammed / reacquired tracks | ${radar.jammed} / ${radar.reacquired} | measured |`,
    '',
    'The matrix advances the real simulation at 20 Hz. It uses authored theater routes, bot vehicle control, weapon collisions, and the production telemetry recorder; it is not a mocked combat model.',
    '',
  ];
  if (errors.length) lines.push('## Failures', '', ...errors.map((error) => `- ${error}`), '');
  return `${lines.join('\n')}\n`;
}

function rotorcraftMarkdown(report: RotorcraftMatrixReport, insertionFailures: string[], supportFailures: string[]): string {
  const contacts = report.support.flatMap((row) => row.firstContact === null ? [] : [row.firstContact]);
  const radar = [...report.insertions, ...report.support].reduce((sum, row) => {
    return {
      sweeps: sum.sweeps + row.radarSweeps,
      contacts: sum.contacts + row.radarContacts,
      jammed: sum.jammed + row.radarJammed,
    };
  }, { sweeps: 0, contacts: 0, jammed: 0 });
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
    `| Radar sweeps / contacts / jammed | ${radar.sweeps} / ${radar.contacts} / ${radar.jammed} | measured |`,
    '',
    'Condors fly authored theater approaches, descend through the shared elevation bands, and land inside compatible LZs. Shrikes use the production vehicle AI and weapons against live armored targets; damage and explosive hits come from the shared telemetry recorder.',
    '',
  ];
  if (errors.length) lines.push('## Failures', '', ...errors.map((error) => `- ${error}`), '');
  return `${lines.join('\n')}\n`;
}

function submarineMarkdown(report: SubmarineMatrixReport, errors: string[]): string {
  const contacts = report.scenarios.flatMap((row) => row.firstContact === null ? [] : [row.firstContact]);
  const totalShots = report.scenarios.reduce((sum, row) => sum + row.shots, 0);
  const totalHits = report.scenarios.reduce((sum, row) => sum + row.hits, 0);
  const lines = [
    '# Submarine Warfare Report',
    '',
    `Status: **${errors.length === 0 ? 'PASS' : 'FAIL'}**`,
    '',
    `Deterministic seeds: ${report.seeds.join(', ')}`,
    '',
    '| Gate | Result | Required |',
    '| --- | ---: | ---: |',
    `| Coastal/Ocean deep-route fights | ${report.scenarios.length} | 20 |`,
    `| Scenario failures | ${errors.length} | 0 |`,
    `| First contact | ${Math.min(...contacts)}-${Math.max(...contacts)}s | every run |`,
    `| Torpedoes / hits | ${totalShots} / ${totalHits} | >0 / >0 |`,
    `| Wrong-depth incidents | ${report.scenarios.reduce((sum, row) => sum + row.wrongDepth, 0)} | 0 |`,
    `| Sonar sweeps / contacts | ${report.scenarios.reduce((sum, row) => sum + row.radarSweeps, 0)} / ${report.scenarios.reduce((sum, row) => sum + row.radarContacts, 0)} | >0 / >0 |`,
    `| Jammed sonar returns | ${report.scenarios.reduce((sum, row) => sum + row.radarJammed, 0)} | 0 |`,
    '',
    'Barracudas dive, follow authored deep routes, acquire through sonar, and exchange torpedoes in the production simulation. Ordinary surface ordnance remains unable to damage submerged hulls.',
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
const submarine = runSubmarineMatrix({ seeds: SEEDS });
const submarineVerdict = evaluateSubmarineMatrix(submarine);
mkdirSync(outputDir, { recursive: true });
writeFileSync(resolve(outputDir, 'foundation-report.json'), `${JSON.stringify({ report, verdict }, null, 2)}\n`);
writeFileSync(resolve(outputDir, 'foundation-report.md'), markdown(report, verdict, foundationErrors));
writeFileSync(resolve(outputDir, 'rotorcraft-report.json'), `${JSON.stringify({ report: rotorcraft, verdict: rotorcraftVerdict }, null, 2)}\n`);
writeFileSync(resolve(outputDir, 'rotorcraft-report.md'), rotorcraftMarkdown(rotorcraft, rotorcraftVerdict.insertionFailures, rotorcraftVerdict.supportFailures));
writeFileSync(resolve(outputDir, 'submarine-report.json'), `${JSON.stringify({ report: submarine, verdict: submarineVerdict }, null, 2)}\n`);
writeFileSync(resolve(outputDir, 'submarine-report.md'), submarineMarkdown(submarine, submarineVerdict.failures));

console.log(`Vehicle theater matrix: ${foundationErrors.length === 0 ? 'PASS' : 'FAIL'} (${report.scenarios.length} scenarios)`);
console.log(`Fixed-wing contact ${verdict.fixedWingFirstContact.min}-${verdict.fixedWingFirstContact.max}s; ground/naval ${verdict.groundNavalFirstContact.min}-${verdict.groundNavalFirstContact.max}s`);
console.log(`Mirrored side win ceiling ${(verdict.maxMirroredWinRate * 100).toFixed(1)}%`);
console.log(`Rotorcraft matrix: ${rotorcraftErrors.length === 0 ? 'PASS' : 'FAIL'} (${rotorcraft.insertions.length + rotorcraft.support.length} scenarios)`);
console.log(`Submarine matrix: ${submarineVerdict.failures.length === 0 ? 'PASS' : 'FAIL'} (${submarine.scenarios.length} scenarios)`);
for (const error of [...foundationErrors, ...rotorcraftErrors, ...submarineVerdict.failures]) console.error(`- ${error}`);
if (foundationErrors.length || rotorcraftErrors.length || submarineVerdict.failures.length) process.exitCode = 1;
