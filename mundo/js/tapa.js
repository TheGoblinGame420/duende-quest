// ═══════════════════════════════════════════════════════
// DUENDE QUEST 3D — lo que tapa al duende se ve a traves
//
// En vez de acercar la camara (brusco), los arboles, casas y rocas que quedan
// entre la camara y el duende se agujerean con un tramado (dither) dentro de
// un tubo camara→duende. Funciona con InstancedMesh, no hay que ordenar
// transparencias y las sombras no cambian.
// ═══════════════════════════════════════════════════════
import * as THREE from 'three';

export const TAPA = { uCam: { value: new THREE.Vector3() }, uTgt: { value: new THREE.Vector3() }, uRad: { value: 1.9 } };

export function transparentar(mat) {
  mat.onBeforeCompile = sh => {
    sh.uniforms.uCam = TAPA.uCam; sh.uniforms.uTgt = TAPA.uTgt; sh.uniforms.uRad = TAPA.uRad;
    sh.vertexShader = 'varying vec3 vTapaW;\n' + sh.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
      vec4 tapaW = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
        tapaW = instanceMatrix * tapaW;
      #endif
      vTapaW = (modelMatrix * tapaW).xyz;`);
    sh.fragmentShader = 'uniform vec3 uCam;\nuniform vec3 uTgt;\nuniform float uRad;\nvarying vec3 vTapaW;\n' + sh.fragmentShader.replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
      {
        vec3 ab = uTgt - uCam;
        float u = dot(vTapaW - uCam, ab) / max(dot(ab, ab), 1e-4);
        if (u > 0.0 && u < 0.97) {
          float d = length(uCam + ab * u - vTapaW);
          float r = uRad * mix(0.6, 1.0, u);
          float f = (1.0 - smoothstep(r * 0.55, r, d)) * 0.88;
          float n = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
          if (n < f) discard;
        }
      }`);
  };
  mat.customProgramCacheKey = () => 'tapa';
  return mat;
}
