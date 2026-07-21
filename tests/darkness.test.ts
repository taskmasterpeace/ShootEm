// ---------------------------------------------------------------------------
// READING THE DARK (STATUS §1 / plan A2) — the analytic cone as a shader
// chunk. These pin the injection contract without a GPU: the GLSL lands in
// the right chunks, the uniforms are SHARED (one write per frame reaches
// every material), the sweep patches lit materials only, and the floor
// mapping keeps `off` at exactly 1 (the classic look, untouched).
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { applyDarkness, darknessFloor, darknessUniforms, setDarknessFrame, sweepDarkness } from '../src/client/darkness';
import { CONE_HALF } from '../src/sim/perception';

/** run a patched material's onBeforeCompile against a minimal fake shader */
function compile(m: THREE.Material) {
  const shader = {
    uniforms: {} as Record<string, { value: unknown }>,
    vertexShader: '#include <common>\n#include <project_vertex>\n',
    fragmentShader: '#include <common>\n#include <dithering_fragment>\n',
  };
  m.onBeforeCompile!(shader as never, null as never);
  return shader;
}

describe('READING THE DARK — the injection contract', () => {
  it('off multiplies by exactly 1 — the classic look is untouched', () => {
    expect(darknessFloor('off')).toBe(1);
    expect(darknessFloor('subtle')).toBeGreaterThan(darknessFloor('full'));
    expect(darknessFloor('full')).toBeGreaterThan(0);
  });

  it('injects the cone into both stages and wires the SHARED uniforms', () => {
    const m = new THREE.MeshStandardMaterial();
    applyDarkness(m);
    expect(m.customProgramCacheKey!()).toBe('ww-dark');
    const sh = compile(m);
    expect(sh.vertexShader).toContain('vWwWorldPos');
    expect(sh.vertexShader).toContain('USE_INSTANCING'); // instanced walls ride too
    expect(sh.fragmentShader).toContain('uWwFloor');
    expect(sh.fragmentShader).toContain('gl_FragColor.rgb *=');
    // the frame write reaches this material through the shared value objects
    setDarknessFrame(5, 0, 7, 1.25, 50, 0.5);
    expect((sh.uniforms.uWwEye.value as THREE.Vector3).x).toBe(5);
    expect(sh.uniforms.uWwYaw.value).toBe(1.25);
    expect(sh.uniforms.uWwFloor.value).toBe(0.5);
    // the cone half-angle is the SIM's own perception law
    expect(sh.uniforms.uWwCone.value).toBe(CONE_HALF);
  });

  it('is idempotent — a second apply never double-wraps', () => {
    const m = new THREE.MeshStandardMaterial();
    applyDarkness(m);
    const once = m.onBeforeCompile;
    applyDarkness(m);
    expect(m.onBeforeCompile).toBe(once);
  });

  it('the sweep patches LIT materials and leaves instruments alone', () => {
    const scene = new THREE.Scene();
    const lit = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
    const lambert = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshLambertMaterial());
    const instrument = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
    scene.add(lit, lambert, instrument);
    const n = sweepDarkness(scene);
    expect(n).toBe(2); // standard + lambert — basic is an instrument
    expect((lit.material as THREE.Material).customProgramCacheKey!()).toBe('ww-dark');
    expect((instrument.material as THREE.Material).customProgramCacheKey).toBe(
      new THREE.MeshBasicMaterial().customProgramCacheKey,
    );
    expect(sweepDarkness(scene), 'second sweep finds nothing new').toBe(0);
  });

  it('the uniforms read back what the frame wrote', () => {
    setDarknessFrame(1, 0, 2, 0.5, 44, 0.28);
    const u = darknessUniforms();
    expect(u.eye.x).toBe(1);
    expect(u.range).toBe(44);
    expect(u.floor).toBe(0.28);
  });
});
