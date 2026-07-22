import { describe, expect, it } from 'vitest';
import { generateScienceMission, type ScienceSite } from '../src/sim/science';
import { generateScienceMap } from '../src/sim/science-map';
import { generateScienceOperationGraph, validateScienceOperationGraph } from '../src/sim/science-operation';

const sites: ScienceSite[] = ['officer-villa', 'research-annex', 'clone-vault'];

function graphFor(seed: number, site: ScienceSite) {
  const spec = generateScienceMission(seed, { site, squadSize: 5, complication: null });
  const layout = generateScienceMap(spec);
  const graph = generateScienceOperationGraph({
    seed: spec.seed,
    map: layout.map,
    building: layout.building,
    entry: layout.entry,
    extraction: layout.extraction,
    objectives: layout.objectiveSockets,
    guardPosts: layout.guardPosts.slice(0, 6),
    reinforcementPosts: layout.reinforcementPosts,
  });
  return { graph, layout };
}

describe('science operation graph', () => {
  it.each(sites)('is deterministic and valid for %s', (site) => {
    const first = graphFor(8100 + sites.indexOf(site), site);
    const second = graphFor(8100 + sites.indexOf(site), site);

    expect(first.graph).toEqual(second.graph);
    expect(validateScienceOperationGraph(first.graph)).toEqual([]);
  });

  it('connects insertion through the objective to extraction', () => {
    const { graph, layout } = graphFor(8110, 'officer-villa');
    expect(graph.nodes.some((node) => node.kind === 'insertion')).toBe(true);
    expect(graph.nodes.some((node) => node.kind === 'objective')).toBe(true);
    expect(graph.nodes.some((node) => node.kind === 'extraction')).toBe(true);
    expect(graph.criticalRoute[0]).toEqual(layout.entry);
    expect(graph.criticalRoute.at(-1)).toEqual(layout.extraction);
    expect(graph.criticalRoute.some((point) => point.y >= 4)).toBe(true);
  });

  it('builds closing patrols, report nodes, and responder approaches', () => {
    const { graph, layout } = graphFor(8111, 'clone-vault');
    expect(graph.patrolRoutes).toHaveLength(6);
    for (const route of graph.patrolRoutes) {
      expect(route.points.length).toBeGreaterThanOrEqual(2);
      expect(route.points.length).toBeLessThanOrEqual(4);
      expect(route.points[0]).toEqual(layout.guardPosts[route.guardIndex]);
      expect(route.points.at(-1)).toEqual(route.points[0]);
    }
    expect(graph.reportNodes.length).toBeGreaterThanOrEqual(1);
    expect(graph.reportNodes.every((node) => node.kind === 'report' && node.roomId !== undefined)).toBe(true);
    expect(graph.responseRoutes).toHaveLength(layout.reinforcementPosts.length);
    expect(graph.responseRoutes.every((route) => route.length >= 2)).toBe(true);
  });

  it('reports useful topology metrics without mutating input sockets', () => {
    const spec = generateScienceMission(8112, { site: 'research-annex', squadSize: 5, complication: null });
    const layout = generateScienceMap(spec);
    const before = JSON.stringify({
      entry: layout.entry,
      extraction: layout.extraction,
      objectives: layout.objectiveSockets,
      guards: layout.guardPosts,
      response: layout.reinforcementPosts,
    });
    const { graph } = graphFor(8112, 'research-annex');

    expect(graph.metrics.rooms).toBeGreaterThanOrEqual(2);
    expect(graph.metrics.edges).toBeGreaterThanOrEqual(graph.metrics.rooms - 1);
    expect(graph.metrics.loops).toBeGreaterThanOrEqual(0);
    expect(graph.metrics.criticalPoints).toBe(graph.criticalRoute.length);
    expect(graph.metrics.patrols).toBe(graph.patrolRoutes.length);
    expect(JSON.stringify({
      entry: layout.entry,
      extraction: layout.extraction,
      objectives: layout.objectiveSockets,
      guards: layout.guardPosts,
      response: layout.reinforcementPosts,
    })).toBe(before);
  });
});
