import type { SemanticDistrict } from './types';

/** Hard importer gates. Warnings remain in the artifact but these issues stop a write. */
export function districtHardIssues(district: SemanticDistrict, minimumEmbedded = 6): string[] {
  const diagnostics = district.diagnostics;
  const issues: string[] = [];
  if (diagnostics.footprintRetention < 0.95) {
    issues.push(`footprint retention ${(diagnostics.footprintRetention * 100).toFixed(1)}% is below 95%`);
  }
  if (diagnostics.unexplainedRoadOverlaps.length) {
    issues.push(`building/carriageway overlap: ${diagnostics.unexplainedRoadOverlaps.join(', ')}`);
  }
  if (diagnostics.disconnectedEntrances.length) {
    issues.push(`disconnected entrance: ${diagnostics.disconnectedEntrances.join(', ')}`);
  }
  if (diagnostics.disconnectedEmbeddedInteriors.length) {
    issues.push(`disconnected embedded interior: ${diagnostics.disconnectedEmbeddedInteriors.join(', ')}`);
  }
  const embedded = district.buildings.filter((building) => building.interiorPolicy === 'embedded').length;
  if (embedded < minimumEmbedded) issues.push(`embedded interiors ${embedded} is below ${minimumEmbedded}`);
  if (embedded > 12) issues.push(`embedded interiors ${embedded} exceeds 12`);
  if (!diagnostics.vehicleAnchorsConnected) issues.push('vehicle anchors are disconnected');
  if (diagnostics.walkableIslands.length) issues.push(`${diagnostics.walkableIslands.length} inaccessible walkable island(s)`);
  return issues;
}
