import * as THREE from 'three';

/* El equipo de mini odontólogos: figuritas de juguete que entran caminando por los lados,
   suben por escaleras o bajan con soga, y limpian la boca diente por diente.
   Todo vive dentro del grupo de la boca, así que se mueve y escala con ella.
   Cada odontólogo sigue un guion escrito como generador: cada `yield` es un cuadro. */

const UP = new THREE.Vector3(0, 1, 0), DOWN = new THREE.Vector3(0, -1, 0);
const FIG = 1.55;   // tamaño de las figuritas (1 = alto de un diente)
const ease = k => k < .5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
const easeOutBack = k => { const c = 1.6; return 1 + (c + 1) * (k - 1) ** 3 + c * (k - 1) ** 2; };

/* ── La figura ── */
export function plastic(color, extra = {}){ return new THREE.MeshPhysicalMaterial({ color, roughness:.42, clearcoat:.35, clearcoatRoughness:.3, ...extra }); }
export const SKINS = ['#E0AC84', '#C98E63', '#F0C29E', '#A8714A'];
export const HAIR = ['#2B1D14', '#3B2A1E', '#1E1A17', '#4A3020'];
/* Bata quirúrgica de tela no tejida: cerrada, larga, con lazo en la cintura y puños blancos.
   Se arma girando un perfil (LatheGeometry) y se le agregan pliegues suaves. */
function gownGeometry(){
  const prof = [[.022, .382], [.05, .372], [.066, .352], [.068, .32], [.062, .27], [.057, .235], [.063, .2], [.072, .15], [.082, .1], [.088, .072]].map(([r, y]) => new THREE.Vector2(r, y));
  const g = new THREE.LatheGeometry(prof, 40), p = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++){ v.fromBufferAttribute(p, i); const r = Math.hypot(v.x, v.z), phi = Math.atan2(v.x, v.z);
    const fold = 1 + (.035 * Math.sin(phi * 9 + v.y * 30) + .02 * Math.sin(phi * 17 - v.y * 55)) * Math.min(1, (.32 - v.y) * 6);
    const k = r * Math.max(.6, fold) / Math.max(r, 1e-6); p.setXYZ(i, v.x * k, v.y, v.z * k); }
  g.computeVertexNormals(); return g;
}
export function makeDentist({ gown, mask:maskC = '#A9D8F0', skin, hair, glasses = false, pants = '#1F2E4A' }){
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const cloth = c => new THREE.MeshPhysicalMaterial({ color:c, roughness:.85, sheen:.6, sheenColor:new THREE.Color('#FFFFFF'), sheenRoughness:.7, side:THREE.DoubleSide });
  const mGown = cloth(gown), mGownDark = cloth(new THREE.Color(gown).multiplyScalar(.82)), mCuff = cloth('#F4F6F7'), mMask = cloth(maskC),
    mSkin = plastic(skin, { roughness:.6, clearcoat:.05 }), mGlove = plastic('#EFE6D6', { roughness:.35, clearcoat:.4 }), mHair = plastic(hair, { roughness:.7, clearcoat:0 }),
    mPants = cloth(pants), mShoe = plastic('#F2F4F6'), mBlack = new THREE.MeshBasicMaterial({ color:'#1B1B1B' }), mWhite = new THREE.MeshBasicMaterial({ color:'#FFFFFF' });
  const add = (parent, geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m; };
  // piernas: cadera y rodilla; el pantalón asoma bajo la bata
  const hips = [-1, 1].map(s => { const hip = new THREE.Group(); hip.position.set(s * .028, .19, 0); body.add(hip);
    add(hip, new THREE.CapsuleGeometry(.021, .07, 4, 10), mPants, 0, -.045, 0);
    const knee = new THREE.Group(); knee.position.y = -.095; hip.add(knee);
    add(knee, new THREE.CapsuleGeometry(.018, .06, 4, 10), mPants, 0, -.04, 0);
    const shoe = add(knee, new THREE.CapsuleGeometry(.016, .04, 4, 10), mShoe, 0, -.085, .014); shoe.rotation.x = Math.PI / 2; shoe.scale.set(1.15, 1, .8);
    hip.userData.knee = knee; return hip; });
  // bata, lazo y cuello redondo
  add(body, gownGeometry(), mGown);
  const tie = add(body, new THREE.TorusGeometry(.059, .0045, 6, 32), mGownDark, 0, .236, 0); tie.rotation.x = Math.PI / 2;
  const knot = add(body, new THREE.SphereGeometry(.008, 8, 6), mGownDark, .02, .234, .056);
  for (const s of [-1, 1]){ const tail = add(body, new THREE.CapsuleGeometry(.004, .04, 3, 6), mGownDark, .02 + s * .008, .208, .058); tail.rotation.z = s * .25; }
  const neckband = add(body, new THREE.TorusGeometry(.024, .004, 6, 20), mGownDark, 0, .381, 0); neckband.rotation.x = Math.PI / 2;
  add(body, new THREE.CylinderGeometry(.017, .019, .03, 12), mSkin, 0, .392, 0);
  // cabeza
  const head = new THREE.Group(); head.position.set(0, .435, 0); body.add(head);
  const skull = add(head, new THREE.SphereGeometry(.05, 22, 16), mSkin); skull.scale.set(.96, 1.1, 1);
  for (const s of [-1, 1]){ add(head, new THREE.SphereGeometry(.012, 8, 6), mSkin, s * .048, .0, -.002).scale.set(.5, 1, .8); }
  for (const s of [-1, 1]){ const e = add(head, new THREE.SphereGeometry(.0065, 8, 6), mBlack, s * .018, .012, .046); e.scale.set(1, 1.25, .6);
    add(head, new THREE.SphereGeometry(.002, 6, 4), mWhite, s * .018 + .002, .015, .05);
    const brow = add(head, new THREE.CapsuleGeometry(.0025, .014, 3, 6), mHair, s * .019, .027, .045); brow.rotation.z = Math.PI / 2 + s * .12; }
  if (glasses) for (const s of [-1, 1]) add(head, new THREE.TorusGeometry(.012, .0022, 6, 16), mBlack, s * .019, .012, .049);
  // gorro abombado del color de la bata, con su borde elástico
  const cap = add(head, new THREE.SphereGeometry(.058, 24, 14, 0, Math.PI * 2, 0, Math.PI * .62), mGown, 0, .012, -.006); cap.scale.set(1.08, .95, 1.1);
  const band = add(head, new THREE.TorusGeometry(.053, .005, 6, 28), mGownDark, 0, .022, -.004); band.rotation.x = Math.PI / 2 - .25;
  // mascarilla plisada con elásticos a las orejas
  const maskM = add(head, new THREE.SphereGeometry(.054, 20, 10, Math.PI * .2, Math.PI * .6, Math.PI * .52, Math.PI * .3), mMask, 0, -.004, .002);
  for (const k of [0, 1, 2]){ const pl = add(head, new THREE.TorusGeometry(.055, .0012, 4, 24, Math.PI * .5), mGownDark, 0, -.012 - k * .011, .002); pl.rotation.set(Math.PI / 2, 0, Math.PI * .25); pl.material = cloth(new THREE.Color(maskC).multiplyScalar(.85)); }
  for (const s of [-1, 1]){ const loop = add(head, new THREE.TorusGeometry(.016, .0015, 4, 12, Math.PI), mCuff, s * .044, -.008, .018); loop.rotation.set(0, s * Math.PI / 2, Math.PI / 2); }
  // brazos: hombro y codo, manga larga con puño blanco y guante
  const arms = [-1, 1].map(s => { const sh = new THREE.Group(); sh.position.set(s * .066, .345, 0); body.add(sh);
    add(sh, new THREE.SphereGeometry(.024, 12, 8), mGown, 0, 0, 0);
    add(sh, new THREE.CapsuleGeometry(.022, .07, 4, 10), mGown, 0, -.05, 0);
    const el = new THREE.Group(); el.position.y = -.095; sh.add(el);
    add(el, new THREE.CapsuleGeometry(.019, .055, 4, 10), mGown, 0, -.035, 0);
    add(el, new THREE.CylinderGeometry(.0185, .0185, .016, 12), mCuff, 0, -.072, 0);
    add(el, new THREE.SphereGeometry(.019, 12, 8), mGlove, 0, -.092, 0).scale.set(.9, 1.15, .75);
    const hand = new THREE.Group(); hand.position.y = -.1; el.add(hand); return { sh, el, hand }; });
  // herramientas (salen de la mano hacia -Y)
  const tools = {};
  { const g = new THREE.Group();
    add(g, new THREE.CylinderGeometry(.008, .008, .14, 8), plastic('#4FB6E8'), 0, -.06, 0);
    add(g, new THREE.BoxGeometry(.022, .05, .022), plastic('#4FB6E8'), 0, -.145, 0);
    add(g, new THREE.BoxGeometry(.03, .04, .028), plastic('#FFFFFF', { roughness:.7, clearcoat:0 }), 0, -.15, .022);
    arms[1].hand.add(g); tools.brush = g; }
  { const g = new THREE.Group();
    add(g, new THREE.CylinderGeometry(.011, .009, .11, 10), plastic('#FFFFFF'), 0, -.05, 0);
    add(g, new THREE.CylinderGeometry(.012, .012, .03, 10), plastic('#1E63C6'), 0, -.11, 0);
    add(g, new THREE.CylinderGeometry(.003, .003, .05, 6), new THREE.MeshStandardMaterial({ color:'#DDE3E7', metalness:1, roughness:.2 }), 0, -.15, 0);
    g.visible = false; arms[1].hand.add(g); tools.drill = g; }
  { const g = new THREE.Group();
    add(g, new THREE.CylinderGeometry(.004, .004, .09, 6), new THREE.MeshStandardMaterial({ color:'#DDE3E7', metalness:1, roughness:.25 }), 0, -.045, 0);
    const d = add(g, new THREE.CylinderGeometry(.016, .016, .004, 16), new THREE.MeshStandardMaterial({ color:'#F2F6F8', metalness:1, roughness:.05 }), 0, -.095, 0); d.rotation.x = Math.PI / 2;
    arms[0].hand.add(g); tools.mirror = g; }
  return { root, body, hips, arms, head, tools };
}

function makeLadder(height){
  const g = new THREE.Group(), m = plastic('#3F73B5', { roughness:.35 });
  for (const s of [-1, 1]){ const r = new THREE.Mesh(new THREE.BoxGeometry(.018, height, .022), m); r.position.set(s * .07, height / 2, 0); r.castShadow = true; g.add(r); }
  const n = Math.round(height / .085);
  for (let i = 1; i < n; i++){ const r = new THREE.Mesh(new THREE.BoxGeometry(.14, .012, .016), m); r.position.y = i * height / n; r.castShadow = true; g.add(r); }
  return g;
}

export function buildCrew(world, mouth, hooks = {}){
  const crew = new THREE.Group(); world.add(crew);
  const { teeth, archPoint, archTangent, FLOOR } = mouth;
  const tooth = fdi => teeth.find(t => t.fdi === fdi);

  /* puntos útiles alrededor de la boca (coordenadas de la boca) */
  const nrAt = (th, o = new THREE.Vector3()) => { const t = archTangent(th); return o.set(-t.z, 0, t.x); };
  // de pie sobre la encía de abajo, a `off` del centro del arco, a la altura de su superficie
  const GR = .4, GH = .37;
  const gumStand = (th, o = new THREE.Vector3(), off = .24) => archPoint(th, o).addScaledVector(nrAt(th), off).setY(GH * Math.sqrt(Math.max(0, 1 - (off / GR) ** 2)) - .005);
  const standOff = t => Math.min(.36, Math.max(.26, t.ty.d / 2 + .13));
  const face = (t, o = new THREE.Vector3()) => o.copy(t.rest).addScaledVector(t.nr, t.ty.d / 2 + .005);
  const occlusal = (t, o = new THREE.Vector3()) => o.copy(t.rest).addScaledVector(t.out, t.ty.h / 2);

  /* espuma */
  const N = 220, foamMat = new THREE.MeshPhysicalMaterial({ color:'#FFFFFF', roughness:.15, clearcoat:1, transmission:.3, thickness:.1, ior:1.33 });
  const foam = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8), foamMat, N); foam.frustumCulled = false; crew.add(foam);
  const bubbles = Array.from({ length:N }, () => ({ on:false, p:new THREE.Vector3(), v:new THREE.Vector3(), life:0, r:.02 }));
  let bc = 0; const ZERO = new THREE.Matrix4().makeScale(0, 0, 0), M = new THREE.Matrix4(), Q = new THREE.Quaternion(), SV = new THREE.Vector3();
  for (let i = 0; i < N; i++) foam.setMatrixAt(i, ZERO);
  function bubble(p, n){ const b = bubbles[bc]; bc = (bc + 1) % N; b.on = true; b.life = 0; b.r = .012 + Math.random() * .022;
    b.p.copy(p).add(SV.set(Math.random() - .5, Math.random() - .5, Math.random() - .5).multiplyScalar(.05));
    b.v.copy(n).multiplyScalar(.15 + Math.random() * .2).add(SV.set((Math.random() - .5) * .3, Math.random() * .15, (Math.random() - .5) * .3)); }
  // polvito del taladro
  const dustMat = new THREE.MeshBasicMaterial({ color:'#F6EEDD' });
  const dust = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 6, 4), dustMat, 80); dust.frustumCulled = false; crew.add(dust);
  const specks = Array.from({ length:80 }, () => ({ on:false, p:new THREE.Vector3(), v:new THREE.Vector3(), life:0 })); let dc = 0;
  for (let i = 0; i < 80; i++) dust.setMatrixAt(i, ZERO);
  function speck(p){ const s = specks[dc]; dc = (dc + 1) % 80; s.on = true; s.life = 0; s.p.copy(p); s.v.set((Math.random() - .5) * .8, .3 + Math.random() * .6, (Math.random() - .5) * .8); }

  /* soga */
  const ropeMat = plastic('#E8A33D', { roughness:.8, clearcoat:0 });
  function makeRope(){ const m = new THREE.Mesh(new THREE.CylinderGeometry(.005, .005, 1, 6), ropeMat); crew.add(m); return m; }
  function setRope(m, a, b){ m.position.lerpVectors(a, b, .5); SV.subVectors(b, a); const L = SV.length(); m.scale.set(1, Math.max(.001, L), 1); m.quaternion.setFromUnitVectors(UP, SV.normalize()); }

  /* escaleras a cada lado, apoyadas en el labio de abajo */
  const ladders = [-1, 1].map(side => {
    const th = side * .62, base = archPoint(th).addScaledVector(nrAt(th), 1.05).setY(FLOOR), top = archPoint(th).addScaledVector(nrAt(th), .34).setY(.25);
    const L = base.distanceTo(top), g = makeLadder(L + .05); crew.add(g);
    const Y = top.clone().sub(base).normalize(), X = archTangent(th).clone(); X.addScaledVector(Y, -X.dot(Y)).normalize(); const Z = new THREE.Vector3().crossVectors(X, Y);
    g.position.copy(base); g.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Y, Z));
    return { g, base, top, th, side, drop:0, home:g.position.clone() };
  });

  /* ── Los cuatro ── */
  const W = [
    { side:-1, jaw:0, look:{ gown:'#2BB596', mask:'#9FE3CF', skin:SKINS[0], hair:HAIR[0], pants:'#1F2E4A' } },
    { side: 1, jaw:0, look:{ gown:'#5A9BE0', mask:'#A9D8F0', skin:SKINS[1], hair:HAIR[1], glasses:true, pants:'#21407A' } },
    { side:-1, jaw:1, look:{ gown:'#5A9BE0', mask:'#A9D8F0', skin:SKINS[2], hair:HAIR[2], pants:'#21407A' } },
    { side: 1, jaw:1, look:{ gown:'#2BB596', mask:'#9FE3CF', skin:SKINS[3], hair:HAIR[3], pants:'#1F2E4A' } },
  ].map(o => {
    const f = makeDentist(o.look); f.root.scale.setScalar(FIG); crew.add(f.root);
    return { ...o, f, pos:new THREE.Vector3(0, -50, 0), yaw:0, yawT:0, state:'idle', phase:Math.random() * 6, aim:null, tool:'brush', rope:o.jaw ? makeRope() : null, anchor:new THREE.Vector3(), hop:0, hopV:0, busy:0, run:null };
  });
  W.forEach(w => { w.f.root.visible = false; if (w.rope) w.rope.visible = false; });

  const _sc = new THREE.Vector3();
  /* ── Pasos del guion ── */
  function* wait(s){ let t = 0; while (t < s) t += yield; }
  function* tween(dur, fn){ let t = 0; fn(0); while (t < dur){ t += yield; fn(Math.min(1, t / dur)); } }
  const faceDir = (w, dx, dz) => { if (dx * dx + dz * dz > 1e-6) w.yawT = Math.atan2(dx, dz); };
  function* walkTo(w, to, speed = 2.2, state = 'walk'){
    const from = w.pos.clone(), d = from.distanceTo(to); w.state = state; faceDir(w, to.x - from.x, to.z - from.z);
    yield* tween(Math.max(.05, d / speed), k => w.pos.lerpVectors(from, to, k)); w.state = 'idle'; }
  function* walkGum(w, th0, th1, off0, off1, speed = .9){
    const p0 = gumStand(th0, undefined, off0), p1 = gumStand(th1, undefined, off1), d = p0.distanceTo(p1); w.state = 'walk';
    yield* tween(Math.max(.05, d / speed), k => { const e = ease(k), prev = w.pos.clone(); gumStand(th0 + (th1 - th0) * e, w.pos, off0 + (off1 - off0) * e); faceDir(w, w.pos.x - prev.x, w.pos.z - prev.z); });
    w.state = 'idle'; }
  function* climb(w, l){
    w.state = 'climb'; faceDir(w, l.top.x - l.base.x, l.top.z - l.base.z);
    const a = l.base.clone(), b = l.top.clone().setY(l.top.y + .02);
    yield* tween(1.1, k => w.pos.lerpVectors(a, b, k));
    w.state = 'walk'; const s = gumStand(l.th, undefined, .24); yield* tween(.35, k => { w.pos.lerpVectors(b, s, k); w.pos.y += Math.sin(k * Math.PI) * .08; });
    w.state = 'idle'; }
  function* hangAt(w, t, dur = .7){
    // colgado frente al diente de arriba
    const to = hangPoint(w, t), from = w.pos.clone();
    w.state = 'hang'; yield* tween(dur, k => { w.pos.lerpVectors(from, to, ease(k)); }); }
  function hangPoint(w, t){ return face(t).addScaledVector(t.nr, .2).addScaledVector(archTangent(t.th), w.side * .2).setY(t.rest.y - .3 * FIG); }
  function aimWork(w, t, kind, time){
    const tan = archTangent(t.th);
    if (kind === 'drill'){ w.aim = t.jaw ? face(t) : occlusal(t); w.aim.addScaledVector(tan, Math.sin(time * 50) * .004); }
    else { w.aim = face(t).addScaledVector(tan, Math.sin(time * 15) * .07).addScaledVector(t.out, (t.jaw ? 1 : -1) * (.02 + Math.sin(time * 2.6) * .07)); }
  }
  function* work(w, t, dur = 1.2){
    w.state = 'brush'; w.tool = 'brush'; faceDir(w, t.rest.x - w.pos.x, t.rest.z - w.pos.z); let tt = 0;
    while (tt < dur){ const dt = yield; tt += dt; w.workT = t;
      if (w.aim && hooks.scrubAt) hooks.scrubAt(crew.localToWorld(_sc.copy(w.aim)), dt * 3.2);
      if (w.aim && Math.random() < dt * 22) bubble(w.aim, t.nr); }
    mouth.finishTooth(t, hooks.onClean); w.workT = null; w.state = 'idle'; }
  function* drill(w, t){
    w.tool = 'drill'; w.state = 'drill'; faceDir(w, t.rest.x - w.pos.x, t.rest.z - w.pos.z); hooks.drill && hooks.drill(true);
    yield* tween(1.6, k => { mouth.fillCaries(t, k < .7 ? k / .7 * .6 : .6 + (k - .7) / .3 * .4); if (w.aim && Math.random() < .5) speck(w.aim); w.workT = t; });
    hooks.drill && hooks.drill(false); hooks.onFilled && hooks.onFilled(t); w.tool = 'brush'; w.workT = null; w.state = 'idle'; }
  function* cheer(w, dur = 1.4){ w.state = 'cheer'; w.yawT = 0; yield* wait(dur); w.state = 'idle'; }

  /* guion de los de abajo: escalera, luego diente por diente por la encía */
  function* lowerScript(w, l){
    const order = [3, 2, 1, 0, 4, 5].map(k => teeth.find(t => t.jaw === 0 && t.side === w.side && t.k === k));
    w.pos.set(w.side * 7.5, FLOOR, l.base.z + .3); w.f.root.visible = true;
    yield* wait(1.4 + (w.side > 0 ? .25 : 0));
    yield* walkTo(w, l.base.clone(), 2.4);
    yield* climb(w, l);
    let th = l.th, off = .24;
    for (const t of order){
      // se para al costado del diente (hacia afuera) para no taparlo
      const wth = t.th + w.side * .13, woff = standOff(t);
      yield* walkGum(w, th, wth, off, woff); th = wth; off = woff;
      if (t.caries && !t.caries.done){ yield* drill(w, t); }
      yield* work(w, t, 1.15);
    }
    w.doneWork = true;
    while (!allDone) yield;
    yield* cheer(w);
    // salta del labio y sale corriendo
    const a = w.pos.clone(), land = archPoint(th).addScaledVector(nrAt(th), 1.1).setY(FLOOR);  // th: donde quedó parado
    w.state = 'jump'; yield* tween(.55, k => { w.pos.lerpVectors(a, land, k); w.pos.y += Math.sin(k * Math.PI) * .35; });
    yield* walkTo(w, new THREE.Vector3(w.side * 8, FLOOR, land.z + .4), 3.2, 'walk');
    w.f.root.visible = false;
  }
  /* guion de los de arriba: bajan con soga y se mueven de diente en diente */
  function* upperScript(w){
    const order = [0, 1, 2, 3, 4, 5].map(k => teeth.find(t => t.jaw === 1 && t.side === w.side && t.k === k));
    const first = order[0], start = hangPoint(w, first); start.y += 6;
    w.pos.copy(start); w.f.root.visible = true; w.rope.visible = true; w.state = 'hang';
    yield* wait(2 + (w.side > 0 ? .35 : 0));
    const to = hangPoint(w, first), from = w.pos.clone();
    yield* tween(1.5, k => { w.pos.lerpVectors(from, to, Math.min(1.05, easeOutBack(k))); });
    for (const t of order){
      yield* hangAt(w, t, t === first ? .01 : .55);
      if (t.caries && !t.caries.done){ yield* drill(w, t); w.state = 'hang'; }
      yield* work(w, t, 1.2); w.state = 'hang';
    }
    w.doneWork = true;
    while (!allDone) yield;
    yield* cheer(w, 1.4); w.state = 'hang';
    const a = w.pos.clone(); yield* tween(1.1, k => { w.pos.copy(a); w.pos.y += k * k * 7; });
    w.f.root.visible = false; w.rope.visible = false;
  }
  function* ladderScript(l){
    const home = l.home.clone(); l.g.visible = true;
    yield* wait(.9 + (l.side > 0 ? .15 : 0));
    yield* tween(.6, k => { l.g.position.copy(home); l.g.position.y += (1 - k) * (1 - k) * 6; });
    hooks.clack && hooks.clack();
    yield* tween(.25, k => { l.g.position.copy(home); l.g.position.y += Math.sin(k * Math.PI) * .05; });
    while (!allDone) yield;
    yield* wait(2.4);
    yield* tween(.8, k => { l.g.position.copy(home); l.g.position.y += k * k * 7; });
    l.g.visible = false;
  }

  let runs = [], allDone = false, playing = false, finished = false;
  function start(){
    mouth.resetAll(); allDone = false; finished = false; playing = true;
    W.forEach(w => { w.doneWork = false; w.state = 'idle'; w.tool = 'brush'; });
    ladders.forEach(l => { l.g.position.copy(l.home); l.g.position.y += 9; l.g.visible = true; });
    runs = [...ladders.map(ladderScript), ...W.map(w => w.jaw ? upperScript(w) : lowerScript(w, ladders[w.side < 0 ? 0 : 1]))];
    runs.forEach(r => r.next());
    hooks.onStart && hooks.onStart();
  }

  /* ── Animar la figura según lo que esté haciendo ── */
  const _a = new THREE.Vector3(), _w = new THREE.Vector3(), _s = new THREE.Vector3();
  function animate(w, dt, time){
    const f = w.f; w.phase += dt * (w.state === 'walk' ? 15 : w.state === 'climb' ? 9 : 5);
    let d = w.yawT - w.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); w.yaw += d * Math.min(1, dt * 10);
    w.hopV -= 9 * dt; w.hop = Math.max(0, w.hop + w.hopV * dt); if (w.hop === 0) w.hopV = Math.max(0, w.hopV);
    f.root.position.copy(w.pos); f.root.position.y += w.hop; f.root.rotation.set(0, w.yaw, 0);
    const [hl, hr] = f.hips, [al, ar] = f.arms, s = Math.sin(w.phase);
    f.body.position.set(0, 0, 0); f.body.rotation.set(0, 0, 0); f.head.rotation.set(0, 0, 0);
    hl.rotation.set(0, 0, 0); hr.rotation.set(0, 0, 0);
    const kl = hl.userData.knee, kr = hr.userData.knee, [el, er] = [f.arms[0].el, f.arms[1].el];
    kl.rotation.x = kr.rotation.x = .05; el.rotation.x = er.rotation.x = -.25;   // de pie: rodillas y codos apenas doblados al.sh.rotation.set(0, 0, .12); ar.sh.rotation.set(0, 0, -.12); al.sh.quaternion.setFromEuler(al.sh.rotation);
    f.tools.brush.visible = w.tool === 'brush'; f.tools.drill.visible = w.tool === 'drill'; f.tools.mirror.visible = !w.jaw;
    switch (w.state){
      case 'walk': case 'jump':
        hl.rotation.x = s * .7; hr.rotation.x = -s * .7; kl.rotation.x = .15 + Math.max(0, -Math.cos(w.phase)) * .9; kr.rotation.x = .15 + Math.max(0, Math.cos(w.phase)) * .9;
        al.sh.rotation.x = -s * .5; ar.sh.rotation.x = s * .5; el.rotation.x = er.rotation.x = -.55; f.body.position.y = Math.abs(Math.cos(w.phase)) * .01; f.body.rotation.x = .06; break;
      case 'climb':
        hl.rotation.x = -1 * Math.max(0, s); hr.rotation.x = -1 * Math.max(0, -s); kl.rotation.x = 1.4 * Math.max(0, s); kr.rotation.x = 1.4 * Math.max(0, -s);
        al.sh.rotation.x = -2.5 + s * .35; ar.sh.rotation.x = -2.5 - s * .35; el.rotation.x = -.5; er.rotation.x = -.5; break;
      case 'hang':
        hl.rotation.x = -.7; hr.rotation.x = -.5; kl.rotation.x = .8; kr.rotation.x = .6; al.sh.rotation.set(-2.9, 0, .1); el.rotation.x = -.3; ar.sh.rotation.set(-.4, 0, -.1); f.body.rotation.x = .12; break;
      case 'cheer':
        al.sh.rotation.set(-2.7, 0, .5 + Math.sin(time * 14) * .35); ar.sh.rotation.set(-2.7, 0, -.5 - Math.sin(time * 14 + 1) * .35); el.rotation.x = er.rotation.x = -.4 + Math.sin(time * 14) * .25;
        if (w.hop === 0 && w.jaw === 0) w.hopV = 1.3; break;
      case 'idle': default: break;
    }
    al.sh.quaternion.setFromEuler(al.sh.rotation); ar.sh.quaternion.setFromEuler(ar.sh.rotation);
    if (w.jaw && w.state !== 'cheer'){ hl.rotation.x = -.75; hr.rotation.x = -.55; kl.rotation.x = .85; kr.rotation.x = .6; al.sh.quaternion.setFromEuler(new THREE.Euler(-2.9, 0, .1)); f.body.rotation.x = .1; }
    // brazo derecho apuntando al diente mientras trabaja
    if ((w.state === 'brush' || w.state === 'drill') && w.workT){
      aimWork(w, w.workT, w.state, time);
      _a.copy(w.aim); crew.localToWorld(_a); f.root.worldToLocal(_a);   // objetivo en coordenadas de la figura
      _s.copy(ar.sh.position); const dir = _a.sub(_s).normalize();
      ar.sh.quaternion.setFromUnitVectors(DOWN, dir); er.rotation.x = -.15;
      f.head.rotation.x = -dir.y * .4;
      if (w.state === 'drill'){ f.body.position.x = (Math.random() - .5) * .006; }
      else { f.body.rotation.z = Math.sin(time * 15) * .03; }
      // el espejito mira al diente
      if (!w.jaw) al.sh.quaternion.setFromUnitVectors(DOWN, _w.set(-.3, .4, 1).normalize());
    } else w.aim = null;
    if (w.rope){ w.anchor.set(w.pos.x, w.pos.y + 9, w.pos.z - .05); setRope(w.rope, w.anchor, _w.copy(w.pos).setY(w.pos.y + .3 * FIG).addScaledVector(new THREE.Vector3(Math.sin(w.yaw), 0, Math.cos(w.yaw)), .02)); }
  }

  let visibleK = 0;
  function update(dt, time, active){
    visibleK += ((active ? 1 : 0) - visibleK) * Math.min(1, dt * 8);
    crew.visible = visibleK > .02; crew.scale.setScalar(Math.max(.001, visibleK));
    if (!active || !playing) return;
    runs = runs.filter(r => !r.next(dt).done);
    if (!allDone && W.every(w => w.doneWork) && mouth.cariesLeft() === 0){ allDone = true; hooks.onAllDone && hooks.onAllDone(); }
    if (!finished && allDone && !runs.length){ finished = true; playing = false; hooks.onFinished && hooks.onFinished(); }
    hooks.scrubbing && hooks.scrubbing(W.some(w => w.state === 'brush'));
    for (const w of W) if (w.f.root.visible) animate(w, dt, time);
    for (let i = 0; i < N; i++){ const b = bubbles[i]; if (!b.on){ foam.setMatrixAt(i, ZERO); continue; }
      b.life += dt; b.v.multiplyScalar(1 - Math.min(1, dt * 3)); b.v.y -= .2 * dt; b.p.addScaledVector(b.v, dt);
      const sc = b.r * Math.min(1, b.life * 8) * Math.max(0, 1 - Math.max(0, b.life - 1) / .5); if (b.life > 1.5){ b.on = false; foam.setMatrixAt(i, ZERO); continue; }
      M.compose(b.p, Q, SV.setScalar(sc)); foam.setMatrixAt(i, M); }
    foam.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < 80; i++){ const s = specks[i]; if (!s.on){ dust.setMatrixAt(i, ZERO); continue; }
      s.life += dt; s.v.y -= 3 * dt; s.p.addScaledVector(s.v, dt); if (s.life > .5){ s.on = false; dust.setMatrixAt(i, ZERO); continue; }
      M.compose(s.p, Q, SV.setScalar(.006 * (1 - s.life * 1.6))); dust.setMatrixAt(i, M); }
    dust.instanceMatrix.needsUpdate = true;
  }
  // al tocar a un odontólogo, salta
  const meshes = []; W.forEach(w => w.f.root.traverse(o => { if (o.isMesh){ o.userData.worker = w; meshes.push(o); } }));
  function poke(w){ if (w.hop === 0) w.hopV = 1.6; }
  return { crew, start, update, meshes, poke, get playing(){ return playing; }, get finished(){ return finished; } };
}
