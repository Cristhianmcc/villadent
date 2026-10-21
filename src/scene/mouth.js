import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/* La boca de la clínica: la misma herradura matemática de Dulcident, pero con
   materiales realistas (encía mate, esmalte marfil) y dientes que guardan su
   propia "suciedad" por vértice para el juego del cepillo. */

const UP = new THREE.Vector3(0, 1, 0);
export const NAMES = ['incisivo central', 'incisivo lateral', 'canino', 'primer premolar', 'segundo premolar', 'primer molar'];
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export function buildMouth(world){
  /* ── Materiales ── */
  const gumMat = new THREE.MeshPhysicalMaterial({ color:'#D9787F', roughness:.36, clearcoat:.55, clearcoatRoughness:.22,
    transmission:.2, thickness:1.1, attenuationColor:new THREE.Color('#A3233A'), attenuationDistance:.8, ior:1.4,
    sheen:.45, sheenColor:new THREE.Color('#FFD9DD'), sheenRoughness:.5 });
  const tongueMat = new THREE.MeshPhysicalMaterial({ color:'#D86B79', roughness:.55, clearcoat:.3, clearcoatRoughness:.4,
    transmission:.15, thickness:1, attenuationColor:new THREE.Color('#9E1F3A'), attenuationDistance:.7,
    sheen:.8, sheenColor:new THREE.Color('#FFD0D8'), sheenRoughness:.6 });
  const palateMat = new THREE.MeshPhysicalMaterial({ color:'#C75F6E', roughness:.4, clearcoat:.4, clearcoatRoughness:.3, side:THREE.DoubleSide,
    transmission:.12, thickness:.9, attenuationColor:new THREE.Color('#8E1A30'), attenuationDistance:.6 });
  const throatMat = new THREE.MeshStandardMaterial({ color:'#4A1420', roughness:.6 });
  const deepMat = new THREE.MeshBasicMaterial({ color:'#1C070B' });
  const toothBase = new THREE.MeshPhysicalMaterial({ color:'#FFFFFF', vertexColors:true, roughness:.24, clearcoat:.85, clearcoatRoughness:.07,
    transmission:.1, thickness:.4, attenuationColor:new THREE.Color('#E6CF9E'), attenuationDistance:.9, ior:1.5 });

  /* ── El arco ── */
  const TH = 1.72, A = 1.72, B = 1.5, C = .32;
  const GUM_RX = .4, GUM_RY = .37, JAW_OPEN = -.22;
  const UPPER = new THREE.Matrix4().compose(new THREE.Vector3(0, 2.12, -.05),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(JAW_OPEN, 0, 0)), new THREE.Vector3(1, 1, 1));
  const UPPER_ROT = new THREE.Quaternion().setFromEuler(new THREE.Euler(JAW_OPEN, 0, 0));
  const archPoint = (th, o = new THREE.Vector3()) => o.set(A * Math.sin(th), 0, B * Math.cos(th) - C);
  const archTangent = (th, o = new THREE.Vector3()) => o.set(A * Math.cos(th), 0, -B * Math.sin(th)).normalize();

  const ARC_N = 800, arcTh = new Float32Array(ARC_N), arcS = new Float32Array(ARC_N);
  { const p = new THREE.Vector3(), q = new THREE.Vector3(); let s = 0;
    for (let i = 0; i < ARC_N; i++){ const th = -TH + 2 * TH * i / (ARC_N - 1); archPoint(th, p);
      if (i) s += p.distanceTo(q); arcTh[i] = th; arcS[i] = s; q.copy(p); } }
  const S_MID = arcS[ARC_N - 1] / 2;
  const thetaAtS = s => { let lo = 0, hi = ARC_N - 1; while (hi - lo > 1){ const m = (lo + hi) >> 1; if (arcS[m] < s) lo = m; else hi = m; }
    const f = (s - arcS[lo]) / Math.max(1e-6, arcS[hi] - arcS[lo]); return arcTh[lo] + (arcTh[hi] - arcTh[lo]) * f; };
  const sAtTheta = th => { const i = Math.round((th + TH) / (2 * TH) * (ARC_N - 1)); return arcS[Math.max(0, Math.min(ARC_N - 1, i))]; };

  /* ── Tipos de diente (del centro hacia atrás) ── */
  const TYPES = [
    { w:.30, h:.50, d:.22, e:.55, incisor:true },
    { w:.27, h:.46, d:.22, e:.55, incisor:true },
    { w:.29, h:.54, d:.28, e:.6, canine:true },
    { w:.32, h:.44, d:.36, e:.5 },
    { w:.33, h:.44, d:.38, e:.5 },
    { w:.42, h:.42, d:.44, e:.45, molar:true },
  ];
  const GAP = .018;
  function toothGeometry(ty){
    const g = new THREE.SphereGeometry(1, 30, 22), p = g.attributes.position, v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++){
      v.fromBufferAttribute(p, i);
      const sx = Math.sign(v.x) * Math.pow(Math.abs(v.x), ty.e), sy = Math.sign(v.y) * Math.pow(Math.abs(v.y), ty.e * .9), sz = Math.sign(v.z) * Math.pow(Math.abs(v.z), ty.e);
      let x = sx * ty.w / 2, y = sy * ty.h / 2, z = sz * ty.d / 2;
      if (sy < 0){ const k = 1 - .34 * sy * sy; x *= k; z *= k; }
      if (ty.canine && sy > 0){ const k = 1 - .4 * sy * sy; x *= k; z *= k; y += .03 * sy; }
      if (ty.incisor && sy > 0) z *= 1 - .32 * sy;
      if (ty.molar && sy > .55) y += .028 * Math.cos(sx * Math.PI * 1.7) * Math.cos(sz * Math.PI * 1.7) - .012;
      p.setXYZ(i, x, y, z);
    }
    g.computeVertexNormals(); return g;
  }
  const toothGeos = TYPES.map(toothGeometry);

  const slots = [];
  for (const side of [-1, 1]){
    let acc = GAP / 2;
    TYPES.forEach((ty, k) => { const s = S_MID + side * (acc + ty.w / 2); slots.push({ s, k, side, th:thetaAtS(s) }); acc += ty.w + GAP; });
  }
  const boundaries = [];
  for (const side of [-1, 1]){ let acc = 0; boundaries.push(S_MID); TYPES.forEach(ty => { acc += ty.w + GAP; boundaries.push(S_MID + side * acc); }); }

  /* ── Encías: tubo en herradura con papilas entre diente y diente ── */
  function buildGum(jaw){
    const N = 96, M = 30, sign = jaw ? -1 : 1, pos = [], idx = [];
    const c = new THREE.Vector3(), t = new THREE.Vector3(), nr = new THREE.Vector3(), p = new THREE.Vector3();
    for (let i = 0; i < N; i++){
      const th = -TH + 2 * TH * i / (N - 1); archPoint(th, c); archTangent(th, t); nr.crossVectors(t, UP);
      const k = Math.min(1, (TH - Math.abs(th)) * 1.55 / .4), cap = Math.sqrt(Math.max(0, 1 - (1 - k) * (1 - k)));
      const s = sAtTheta(th); let db = 9; for (const b of boundaries) db = Math.min(db, Math.abs(s - b));
      const inTeeth = Math.abs(s - S_MID) < 1.95 ? 1 : 0, pap = inTeeth * Math.exp(-((db / .05) ** 2));
      for (let j = 0; j < M; j++){
        const ph = 2 * Math.PI * j / M, cs = Math.cos(ph), sn = Math.sin(ph);
        const top = Math.max(0, sn * sign);
        p.copy(c).addScaledVector(nr, cs * GUM_RX * cap * (1 + .08 * top)).addScaledVector(UP, sn * GUM_RY * cap + sign * .07 * pap * top ** 6);
        if (jaw) p.applyMatrix4(UPPER);
        pos.push(p.x, p.y, p.z);
      }
    }
    for (let i = 0; i < N - 1; i++) for (let j = 0; j < M; j++){
      const a = i * M + j, b = i * M + (j + 1) % M, cc = (i + 1) * M + j, d = (i + 1) * M + (j + 1) % M;
      idx.push(a, cc, b, b, cc, d);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    world.add(new THREE.Mesh(g, gumMat));
  }
  buildGum(0); buildGum(1);

  function buildPillar(side){
    const th = side * (TH - .2), lo = archPoint(th), hi = archPoint(th).applyMatrix4(UPPER);
    const nr = new THREE.Vector3().crossVectors(archTangent(th), UP).multiplyScalar(.18);
    const ctrl = lo.clone().lerp(hi, .5).add(nr).add(new THREE.Vector3(0, 0, -.12));
    const curve = new THREE.QuadraticBezierCurve3(lo, ctrl, hi);
    const N = 26, M = 22, pos = [], idx = [];
    const t = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3(), p = new THREE.Vector3();
    for (let i = 0; i < N; i++){
      const u = i / (N - 1); const c = curve.getPoint(u); curve.getTangent(u, t);
      a.set(0, 0, 1).cross(t).normalize(); if (a.lengthSq() < .1) a.set(1, 0, 0); b.crossVectors(t, a).normalize();
      const r = .36 - .15 * Math.sin(Math.PI * u);
      for (let j = 0; j < M; j++){ const ph = 2 * Math.PI * j / M; p.copy(c).addScaledVector(a, Math.cos(ph) * r).addScaledVector(b, Math.sin(ph) * r * 1.1); pos.push(p.x, p.y, p.z); }
    }
    for (let i = 0; i < N - 1; i++) for (let j = 0; j < M; j++){ const q = i * M + j, r = i * M + (j + 1) % M, s2 = (i + 1) * M + j, d = (i + 1) * M + (j + 1) % M; idx.push(q, s2, r, r, s2, d); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    world.add(new THREE.Mesh(g, gumMat));
  }
  buildPillar(-1); buildPillar(1);

  const palate = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2), palateMat);
  palate.scale.set(1.5, .62, 1.22); palate.position.set(0, .05, -.22).applyMatrix4(UPPER); palate.quaternion.copy(UPPER_ROT); world.add(palate);
  const throat = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 24), throatMat);
  throat.scale.set(1.3, .95, .45); throat.position.set(0, 1.08, -.86); world.add(throat);
  const deep = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), deepMat);
  deep.scale.set(.62, .5, .2); deep.position.set(0, 1.08, -.48); world.add(deep);
  const uvulaPivot = new THREE.Group(); uvulaPivot.position.set(0, 1.74, -.42); world.add(uvulaPivot);
  const uvula = new THREE.Mesh(new THREE.CapsuleGeometry(.075, .18, 8, 16), palateMat); uvula.position.y = -.19; uvulaPivot.add(uvula);

  const tongueGeo = new THREE.SphereGeometry(1, 64, 40);
  { const p = tongueGeo.attributes.position; for (let i = 0; i < p.count; i++){ let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      if (y > 0) y -= .26 * Math.exp(-((x / .17) ** 2)) * y; if (z > .3) y += .08 * (z - .3); p.setXYZ(i, x, y, z); } tongueGeo.computeVertexNormals(); }
  const tongue = new THREE.Mesh(tongueGeo, tongueMat); tongue.position.set(0, .2, -.12); tongue.scale.set(1.2, .42, 1.02); world.add(tongue);

  /* ── Dientes con placa pintada por vértice ── */
  const TIP = new THREE.Color('#FBF8F1'), NECK = new THREE.Color('#EADDC2'), PLAQUE = new THREE.Color('#D2AE55'), TARTAR = new THREE.Color('#8A6634');
  const _c = new THREE.Color();
  const teeth = [], toothMeshes = [];
  slots.forEach(sl => [0, 1].forEach(jaw => {
    const ty = TYPES[sl.k];
    const c = archPoint(sl.th), t = archTangent(sl.th), nr = new THREE.Vector3().crossVectors(t, UP);
    const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(t, UP, nr));
    const rest = c.clone();
    if (jaw === 0) rest.y = GUM_RY - .1 + ty.h / 2;
    else { rest.y = -(GUM_RY - .1 + ty.h / 2); rest.applyMatrix4(UPPER); q.premultiply(UPPER_ROT).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI)); nr.applyQuaternion(UPPER_ROT); }
    const out = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
    const geo = toothGeos[sl.k].clone(), P = geo.attributes.position, Nn = geo.attributes.normal, n = P.count;
    const dirt = new Float32Array(n), yn = new Float32Array(n), counted = new Uint8Array(n);
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    const a = Math.random() * 9, b = Math.random() * 9, back = sl.k / 5;
    let nCount = 0;
    for (let i = 0; i < n; i++){
      const x = P.getX(i), y = P.getY(i) / (ty.h / 2), z = P.getZ(i); yn[i] = y;
      const neck = 1 - smooth(-.55, .45, y);
      const nz = .5 + .25 * Math.sin(x * 31 + a) * Math.cos(z * 23 + b) + .25 * Math.sin(y * 17 + z * 29 + a);
      const patch = smooth(.52, .7, nz);   // manchas sueltas además de la franja del cuello
      dirt[i] = Math.min(1, Math.max(0, .16 + .78 * neck + .55 * patch + .1 * back));
      counted[i] = y > -.5 && (Nn.getZ(i) > -.15 || Nn.getY(i) > .6) ? 1 : 0; nCount += counted[i];
    }
    const mat = toothBase.clone();
    const mesh = new THREE.Mesh(geo, mat); mesh.position.copy(rest); mesh.quaternion.copy(q); mesh.castShadow = true; world.add(mesh);
    const quad = jaw ? (sl.side < 0 ? 1 : 2) : (sl.side > 0 ? 3 : 4);
    const tooth = { mesh, mat, geo, ty, k:sl.k, jaw, side:sl.side, th:sl.th, rest, q, out, nr, fdi:quad * 10 + sl.k + 1,
      name:`${NAMES[sl.k]} ${jaw ? 'superior' : 'inferior'} ${sl.side < 0 ? 'derecho' : 'izquierdo'}`,
      dirt, dirt0:dirt.slice(), yn, counted, nCount, avg:1, clean:false, dirty:true,
      modeGlow:0, pickGlow:0, lift:0, liftT:0, bob:0 };
    mesh.userData.tooth = tooth;
    teeth.push(tooth); toothMeshes.push(mesh);
  }));

  // fuera del juego la placa se esconde: en el resto de la página la sonrisa se ve sana
  let show = 1, painted = 1;
  function paint(t){
    const col = t.geo.attributes.color; let sum = 0;
    for (let i = 0; i < t.dirt.length; i++){
      const d = t.dirt[i] * show;
      _c.copy(NECK).lerp(TIP, smooth(-.4, .8, t.yn[i]));
      _c.lerp(PLAQUE, Math.min(1, d * 1.05));
      if (d > .7) _c.lerp(TARTAR, (d - .7) * 1.4 * (1 - smooth(-.6, .2, t.yn[i])));
      col.setXYZ(i, _c.r, _c.g, _c.b);
      if (t.counted[i]) sum += t.dirt[i];
    }
    col.needsUpdate = true; t.avg = sum / Math.max(1, t.nCount); t.dirty = false;
  }
  teeth.forEach(paint);

  /* ── Frotar: baja la placa de los vértices cerca del punto ── */
  const _l = new THREE.Vector3(), _v = new THREE.Vector3();
  const R = .24;
  function scrub(hitWorld, amount, onClean){
    _v.copy(hitWorld); world.worldToLocal(_v);
    for (const t of teeth){
      if (t.clean || t.rest.distanceToSquared(_v) > .3) continue;
      _l.copy(hitWorld); t.mesh.worldToLocal(_l);
      const P = t.geo.attributes.position; let touched = false;
      for (let i = 0; i < P.count; i++){
        const dx = P.getX(i) - _l.x, dy = P.getY(i) - _l.y, dz = P.getZ(i) - _l.z, d2 = dx * dx + dy * dy + dz * dz;
        if (d2 > R * R) continue;
        const f = 1 - Math.sqrt(d2) / R; t.dirt[i] = Math.max(0, t.dirt[i] - amount * f * f * 2); touched = true;
      }
      if (touched){ paint(t); if (t.avg < .2){ t.clean = true; t.fading = true; onClean && onClean(t); } }
    }
  }
  function resetDirt(){ for (const t of teeth){ t.dirt.set(t.dirt0); t.clean = false; t.fading = false; paint(t); } }
  const cleanCount = () => teeth.filter(t => t.clean).length;
  const progress = () => { let s = 0, s0 = 0; for (const t of teeth){ for (let i = 0; i < t.dirt.length; i++) if (t.counted[i]){ s += t.dirt[i]; s0 += t.dirt0[i]; } } return 1 - s / s0; };

  /* ── Ortodoncia ──
     Brackets metálicos como los reales: base, cuerpo con ranura, cuatro aletas y una ligadura
     alrededor; bandas con tubo en los molares y un arco de alambre que pasa por las ranuras.
     Además, una copia de los dientes "antes": chuecos, apiñados, sin brackets.
     Un plano vertical corta la boca: a un lado se ven los chuecos, al otro los derechos con brackets. */
  const keepLeft = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 1e4);   // los chuecos: x < corte
  const keepRight = new THREE.Plane(new THREE.Vector3(1, 0, 0), 1e4);   // los derechos: x > corte
  const metal = new THREE.MeshPhysicalMaterial({ color:'#E3E9ED', metalness:1, roughness:.16, clearcoat:.5, clearcoatRoughness:.08, clippingPlanes:[keepRight] });
  const ligMat = new THREE.MeshPhysicalMaterial({ color:'#B9C6CF', roughness:.28, metalness:.1, clearcoat:1, clearcoatRoughness:.1, clippingPlanes:[keepRight] });
  for (const t of teeth){ t.mat.clippingPlanes = [keepRight]; t.mat.clipShadows = true; }
  metal.clipShadows = ligMat.clipShadows = true;

  const Bx = (w, h, d, x, y, z) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);
  // un bracket en coordenadas del diente: x a lo largo del arco, y hacia la corona, z hacia afuera
  function bracketParts(){
    const metalParts = [
      Bx(.13, .118, .014, 0, 0, .007),                 // base pegada al esmalte
      Bx(.09, .03, .03, 0, .027, .026), Bx(.09, .03, .03, 0, -.027, .026),   // cuerpo partido por la ranura
      Bx(.032, .03, .034, -.03, .052, .03), Bx(.032, .03, .034, .03, .052, .03),   // aletas de arriba
      Bx(.032, .03, .034, -.03, -.052, .03), Bx(.032, .03, .034, .03, -.052, .03), // aletas de abajo
    ];
    const lig = new THREE.TorusGeometry(.046, .009, 8, 24).scale(1, 1.18, 1).translate(0, 0, .036);
    return { metal:mergeGeometries(metalParts), lig };
  }
  const BR = bracketParts();
  // punto del esmalte en la cara de afuera, a la altura del bracket
  function labialPoint(t, yc){
    const P = t.geo.attributes.position; let z = 0;
    for (let i = 0; i < P.count; i++) if (Math.abs(P.getX(i)) < t.ty.w * .22 && Math.abs(P.getY(i) - yc) < .06) z = Math.max(z, P.getZ(i));
    return z;
  }
  const metalGeos = [], ligGeos = [], M4 = new THREE.Matrix4(), Mo = new THREE.Matrix4();
  for (const jaw of [0, 1]){
    const row = teeth.filter(t => t.jaw === jaw).sort((a, b) => a.side * (a.k + .5) - b.side * (b.k + .5));
    const wirePts = [];
    for (const t of row){
      const yc = t.ty.h * (t.k >= 3 ? .1 : .06), zf = labialPoint(t, yc);
      M4.compose(t.rest, t.q, new THREE.Vector3(1, 1, 1));
      const sc = THREE.MathUtils.clamp(t.ty.w / .3, .85, 1.08);
      if (t.k <= 4){
        Mo.makeTranslation(0, yc, zf - .004).multiply(new THREE.Matrix4().makeScale(sc, 1, 1));
        const m = M4.clone().multiply(Mo);
        metalGeos.push(BR.metal.clone().applyMatrix4(m)); ligGeos.push(BR.lig.clone().applyMatrix4(m));
        wirePts.push(new THREE.Vector3(0, yc, zf + .026).applyMatrix4(M4));
      } else {
        // molar: banda alrededor de la corona y un tubo por donde entra el alambre
        const band = new THREE.CylinderGeometry(1, 1, .1, 32, 1, true).scale(t.ty.w / 2 + .012, 1, t.ty.d / 2 + .012).translate(0, yc - .02, 0);
        const tube = Bx(.12, .04, .035, 0, yc, zf + .028);
        metalGeos.push(band.applyMatrix4(M4), tube.applyMatrix4(M4));
        wirePts.push(new THREE.Vector3(.05 * -t.side, yc, zf + .028).applyMatrix4(M4));
      }
    }
    const curve = new THREE.CatmullRomCurve3(wirePts, false, 'centripetal');
    metalGeos.push(new THREE.TubeGeometry(curve, 160, .0115, 8, false));
  }
  const ortho = new THREE.Group(); world.add(ortho); ortho.visible = false;
  const toNonIndexed = g => g.index ? g.toNonIndexed() : g;
  const bracketMesh = new THREE.Mesh(mergeGeometries(metalGeos.map(toNonIndexed)), metal); bracketMesh.castShadow = true;
  const ligMesh = new THREE.Mesh(mergeGeometries(ligGeos.map(toNonIndexed)), ligMat);
  ortho.add(bracketMesh, ligMesh);

  // los dientes "antes": misma forma, limpios, girados y apiñados
  const crooked = new THREE.Group(); world.add(crooked); crooked.visible = false;
  const CROOK = {          // por tipo: giro sobre su eje, inclinación, adelante/atrás, arriba/abajo, de lado
    0:{ rot:.55, tilt:.14, lab:.08, up:.03, tan:.03 },
    1:{ rot:-.65, tilt:-.16, lab:-.1, up:-.04, tan:-.04 },
    2:{ rot:.3, tilt:.2, lab:.13, up:-.14, tan:.04 },
    3:{ rot:-.3, tilt:.1, lab:-.05, up:.02, tan:.0 },
    4:{ rot:.18, tilt:-.06, lab:.02, up:.02, tan:.0 },
    5:{ rot:.08, tilt:.06, lab:0, up:0, tan:0 },
  };
  const AXY = new THREE.Vector3(0, 1, 0), AXZ = new THREE.Vector3(0, 0, 1), TAN = new THREE.Vector3();
  for (const t of teeth){
    const c = CROOK[t.k], f = (t.side * (t.jaw ? 1 : -1)) * (t.k % 2 ? 1 : -1) * (t.jaw && t.k === 0 && t.side > 0 ? -.6 : 1);
    const g = t.geo.clone(); const col = g.attributes.color, cc = new THREE.Color();
    for (let i = 0; i < col.count; i++){ cc.copy(NECK).lerp(TIP, smooth(-.4, .8, t.yn[i])); col.setXYZ(i, cc.r, cc.g, cc.b); }
    const mat = toothBase.clone(); mat.clippingPlanes = [keepLeft]; mat.clipShadows = true;
    const m = new THREE.Mesh(g, mat); m.castShadow = true;
    TAN.set(1, 0, 0).applyQuaternion(t.q);
    m.position.copy(t.rest).addScaledVector(t.nr, c.lab * f).addScaledVector(t.out, c.up * (t.jaw || t.k !== 2 ? 1 : .3)).addScaledVector(TAN, c.tan * f);
    m.quaternion.copy(t.q).multiply(new THREE.Quaternion().setFromAxisAngle(AXY, c.rot * f)).multiply(new THREE.Quaternion().setFromAxisAngle(AXZ, c.tilt * f));
    crooked.add(m);
  }
  /* ── Caries: manchas oscuras que el equipo taladra y rellena ── */
  const CARIES_DARK = new THREE.Color('#3A2416'), SILVER = new THREE.Color('#C8D1D7'), _cc = new THREE.Color();
  for (const fdi of [46, 36, 21]){
    const t = teeth.find(x => x.fdi === fdi);
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 12), new THREE.MeshStandardMaterial({ color:CARIES_DARK, roughness:.7, clippingPlanes:[keepRight] }));
    if (t.jaw === 0){ m.scale.set(t.ty.w * .2, .028, t.ty.d * .2); m.position.set(.02, t.ty.h / 2 - .012, 0); }
    else { const y = t.ty.h * .12, z = labialPoint(t, y); m.scale.set(.05, .06, .022); m.position.set(.03, y, z - .006); }
    t.mesh.add(m); t.caries = { mesh:m, k:0, done:false, base:m.scale.clone() };
  }
  // k: 0 = caries, .6 = plata (taladrada y limpia), 1 = rellena del color del diente
  function fillCaries(t, k){ const c = t.caries; if (!c) return; c.k = k;
    if (k < .6) _cc.copy(CARIES_DARK).lerp(SILVER, k / .6); else _cc.copy(SILVER).lerp(TIP, (k - .6) / .4);
    c.mesh.material.color.copy(_cc); const sh = k < .85 ? 1 : 1 - (k - .85) / .15; c.mesh.scale.copy(c.base).multiplyScalar(Math.max(.001, sh)); c.mesh.visible = sh > .01;
    c.done = k >= 1; }
  const cariesLeft = () => teeth.filter(t => t.caries && !t.caries.done).length;
  // el diente queda limpio de una vez (cuando el odontólogo termina con él)
  function finishTooth(t, onClean){ if (t.clean) return; t.clean = true; t.fading = true; onClean && onClean(t); }
  function resetAll(){ resetDirt(); for (const t of teeth) if (t.caries) fillCaries(t, 0); }

  let split = { on:false, x:0 };
  function setSplit(on, x = 0){ split.on = on; split.x = x;
    crooked.visible = on;
    if (on){ keepLeft.constant = x; keepRight.constant = -x; } else { keepLeft.constant = 1e4; keepRight.constant = 1e4; } }

  /* ── Modos: lo que se ve al pasar por cada tratamiento ── */
  const MODES = {
    limpieza:       { color:'#57C7CC', all:true },
    resinas:        { color:'#E9B35A', fdi:[36, 15, 46, 26] },
    endodoncia:     { color:'#E2554F', fdi:[36] },
    ortodoncia:     { color:'#9FB3BC', ortho:true },
    protesis:       { color:'#9FC6F0', fdi:[44, 45, 46], bob:true },
    blanqueamiento: { color:'#FFFFFF', all:true, white:true },
  };
  for (const k in MODES) MODES[k].c = new THREE.Color(MODES[k].color);
  let mode = null, orthoK = 0;
  function setMode(name){ mode = MODES[name] ? name : null; }

  /* ── Selección para la reserva ── */
  let hovered = null, chosen = null;
  const TEAL = new THREE.Color('#2BA6A8'), _e = new THREE.Color();
  let spot = null; const WARM = new THREE.Color('#FFF1C9');
  function setSpot(t){ spot = t; }   // diente alumbrado por la linterna
  function setHover(t){ hovered = t; }
  function choose(t){ chosen = t; if (t){ t.liftT = 1; } }

  function setDirtShow(f){ show = f; if (Math.abs(show - painted) > .02 || (show !== painted && (show === 0 || show === 1))){ painted = show; teeth.forEach(paint); } }
  const uv = { a:0, v:0 };
  function update(dt, time, motion = 0){
    const m = mode && MODES[mode];
    // un diente limpio termina de quedar blanco solo
    for (const t of teeth) if (t.fading){ let left = 0; for (let i = 0; i < t.dirt.length; i++){ t.dirt[i] = Math.max(0, t.dirt[i] - dt * 1.4); left += t.dirt[i]; }
      paint(t); if (left === 0) t.fading = false; }
    for (const t of teeth){
      const inSet = m && (m.all || (m.fdi && m.fdi.includes(t.fdi)));
      const target = inSet ? (m.white ? .2 : .28 + .14 * Math.sin(time * 4 + t.fdi)) : 0;
      t.modeGlow += (target - t.modeGlow) * Math.min(1, dt * 8);
      const pickT = t === chosen ? 1 : t === hovered ? .4 : 0;
      t.pickGlow += (pickT - t.pickGlow) * Math.min(1, dt * 12);
      _e.setRGB(0, 0, 0);
      if (t.modeGlow > .002) _e.copy(m ? m.c : TEAL).multiplyScalar(t.modeGlow);
      if (t.pickGlow > .002) _e.lerp(TEAL, Math.min(1, t.pickGlow)).multiplyScalar(.75);
      t.spotGlow = (t.spotGlow || 0) + (((t === spot) ? .55 : 0) - (t.spotGlow || 0)) * Math.min(1, dt * 10);
      if (t.spotGlow > .002) _e.lerp(WARM, Math.min(1, t.spotGlow)).multiplyScalar(.6 + .4 * (1 - t.spotGlow));
      t.mat.emissive.copy(_e);
      // el elegido da un saltito y vuelve
      t.lift += (t.liftT - t.lift) * Math.min(1, dt * 14); t.liftT *= Math.exp(-dt * 6);
      let up = t.lift * .08;
      // prótesis: las piezas suben y vuelven a asentarse, como un puente que se coloca
      t.bob += (((inSet && m.bob) ? 1 : 0) - t.bob) * Math.min(1, dt * 6);
      if (t.bob > .001) up += t.bob * .32 * (.5 + .5 * Math.sin(time * 2.6));
      t.mesh.position.copy(t.rest).addScaledVector(t.out, up);
    }
    orthoK += (((m && m.ortho) || split.on ? 1 : 0) - orthoK) * Math.min(1, dt * 7);
    // los brackets se asientan desde afuera hacia el diente
    ortho.visible = orthoK > .01; ortho.scale.setScalar(1 + (1 - orthoK) * .06); ortho.children.forEach(c => { c.material.opacity = orthoK; c.material.transparent = orthoK < .99; });
    uv.v += (-50 * uv.a - 3 * uv.v - motion * 3) * dt; uv.a += uv.v * dt;
    uvulaPivot.rotation.set(Math.sin(time * 1.3) * .02, 0, uv.a * .35 + Math.sin(time * 1.1) * .025);
  }

  world.traverse(o => { if (o.isMesh && o.material !== deepMat) o.castShadow = true; });
  return { setSpot, ortho, teeth, toothMeshes, scrub, setDirtShow, setSplit, fillCaries, cariesLeft, finishTooth, resetAll,
    archPoint, archTangent, GUM_RY, UP, resetDirt, cleanCount, progress, setMode, setHover, choose, update, FLOOR:-.37 };
}
