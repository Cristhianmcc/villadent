import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';

/* Piso espejo suave: Three.js da el reflejo (Reflector) y este shader lo vuelve
   borroso, tenue y con un desvanecido circular, como un piso de estudio pulido. */
const SoftMirrorShader = {
  name: 'SoftMirrorShader',
  uniforms: {
    color: { value: null },
    tDiffuse: { value: null },
    textureMatrix: { value: null },
    opacity: { value: .3 },
    radius: { value: 3.4 },
    blur: { value: 2.2 },
    texel: { value: new THREE.Vector2(1 / 1024, 1 / 1024) },
  },
  vertexShader: /* glsl */`
    uniform mat4 textureMatrix;
    varying vec4 vUv;
    varying vec2 vPlane;
    void main(){
      vUv = textureMatrix * vec4(position, 1.0);
      vPlane = position.xy;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */`
    uniform vec3 color;
    uniform sampler2D tDiffuse;
    uniform float opacity, radius, blur;
    uniform vec2 texel;
    varying vec4 vUv;
    varying vec2 vPlane;
    void main(){
      vec2 uv = vUv.xy / vUv.w;
      // desenfoque gaussiano de 5x5: el reflejo se ve como sobre plástico pulido, no como un espejo
      vec4 acc = vec4(0.0); float wsum = 0.0;
      for (int i = -2; i <= 2; i++) for (int j = -2; j <= 2; j++){
        float w = exp(-float(i * i + j * j) / 4.0);
        acc += texture2D(tDiffuse, uv + vec2(float(i), float(j)) * texel * blur) * w; wsum += w;
      }
      vec4 c = acc / wsum;
      float d = length(vPlane * vec2(1.0, 1.35)) / radius;
      float fade = 1.0 - smoothstep(0.0, 1.0, d);
      gl_FragColor = vec4(c.rgb * color, opacity * fade * fade);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
};

export function makeSoftMirror(renderer, { size = 16, radius = 3.4, opacity = .3, res = 1024 } = {}){
  const mirror = new Reflector(new THREE.PlaneGeometry(size, size), {
    shader: SoftMirrorShader, textureWidth: res, textureHeight: res, clipBias: .003, color: 0xffffff,
  });
  mirror.rotation.x = -Math.PI / 2;
  mirror.renderOrder = -2;
  const m = mirror.material;
  m.transparent = true; m.depthWrite = false;
  m.uniforms.opacity.value = opacity; m.uniforms.radius.value = radius;
  m.uniforms.texel.value.set(1 / res, 1 / res);
  return mirror;
}
