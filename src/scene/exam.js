import * as THREE from 'three';
import { makeDentist, plastic, SKINS, HAIR } from './crew.js';

/* "Tu primera visita": tres mini odontólogos revisan la boca.
   Uno alumbra los dientes de arriba con linterna, otro mira las muelas con lupa
   parado sobre la lengua y el tercero anota en su tablilla. Se repite sin fin. */

const DOWN = new THREE.Vector3(0, -1, 0);
const FIG = 1.55;

export function buildExam(world, mouth, hooks = {}){
  const team = new THREE.Group(); world.add(team); team.visible = false;
  const { teeth, archPoint, archTangent } = mouth;
  const tooth = fdi => teeth.find(t => t.fdi === fdi);
  // lo que encontraron en la pieza: sana o con caries (si el visitante no esperó a la limpieza del inicio)
  const nameOf = t => t.name[0].toUpperCase() + t.name.slice(1);   // p. ej. "Canino superior derecho"
  const verdict = t => t.caries && !t.caries.done ? { text:`${nameOf(t)}: caries`, warn:true } : { text:`${nameOf(t)} ✓`, warn:false };
  const nrAt = th => { const t = archTangent(th); return new THREE.Vector3(-t.z, 0, t.x); };
  const gumStand = (th, off) => archPoint(th).addScaledVector(nrAt(th), off).setY(.37 * Math.sqrt(Math.max(0, 1 - (off / .4) ** 2)) - .005);
  const face = t => t.rest.clone().addScaledVector(t.nr, t.ty.d / 2 + .005);
  const occlusal = t => t.rest.clone().addScaledVector(t.out, t.ty.h / 2);
  const add = (p, g, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.castShadow = true; p.add(o); return o; };

  /* ── Herramientas nuevas ── */
  function flashlight(hand){
    const g = new THREE.Group(); hand.add(g);
    add(g, new THREE.CylinderGeometry(.011, .009, .07, 12), plastic('#22303C'), 0, -.03, 0);
    add(g, new THREE.CylinderGeometry(.015, .012, .02, 14), plastic('#C9D2D8', { metalness:.8, roughness:.25 }), 0, -.07, 0);
    add(g, new THREE.CircleGeometry(.012, 14), new THREE.MeshBasicMaterial({ color:'#FFF6D8' }), 0, -.0805, 0).rotation.x = Math.PI / 2;
    // el haz: un cono abierto, aditivo, que se desvanece hacia la punta
    const L = .7, beamGeo = new THREE.ConeGeometry(.09, L, 24, 1, true).translate(0, -L / 2, 0).rotateX(Math.PI);
    { const p = beamGeo.attributes.position, col = new Float32Array(p.count * 3); for (let i = 0; i < p.count; i++){ const k = Math.min(1, -p.getY(i) / L); const a = .35 + .65 * (1 - k) * (1 - k); col.set([a, a * .88, a * .55], i * 3); } beamGeo.setAttribute('color', new THREE.BufferAttribute(col, 3)); }
    const beam = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ vertexColors:true, transparent:true, opacity:.2, blending:THREE.AdditiveBlending, depthWrite:false, side:THREE.DoubleSide, toneMapped:false }));
    beam.position.y = -.08; beam.rotation.x = Math.PI; beam.renderOrder = 5; g.add(beam);
    return { g, beam };
  }
  function magnifier(hand){
    const g = new THREE.Group(); hand.add(g);
    add(g, new THREE.CylinderGeometry(.008, .008, .07, 10), plastic('#7A4A2A'), 0, -.035, 0);
    const rim = add(g, new THREE.TorusGeometry(.04, .006, 8, 28), plastic('#2B2B2B', { metalness:.5, roughness:.3 }), 0, -.11, 0); rim.rotation.y = Math.PI / 2;
    const lens = add(g, new THREE.CircleGeometry(.038, 24), new THREE.MeshPhysicalMaterial({ color:'#DFF2FF', roughness:0, metalness:0, transparent:true, opacity:.35, clearcoat:1, side:THREE.DoubleSide }), 0, -.11, 0); lens.rotation.y = Math.PI / 2; lens.castShadow = false;
    return g;
  }
  function clipboard(hand){
    const g = new THREE.Group(); hand.add(g); g.position.set(0, -.02, .02); g.rotation.set(-1.1, 0, 0);
    add(g, new THREE.BoxGeometry(.075, .1, .006), plastic('#A86B3C'));
    const paper = add(g, new THREE.BoxGeometry(.065, .085, .002), plastic('#FFFFFF', { roughness:.9, clearcoat:0 }), 0, -.004, .004);
    for (let i = 0; i < 4; i++) add(g, new THREE.BoxGeometry(.045, .003, .001), new THREE.MeshBasicMaterial({ color:'#9FB3C8' }), -.004, .02 - i * .014, .0055);
    add(g, new THREE.BoxGeometry(.03, .012, .01), plastic('#C9D2D8', { metalness:.8, roughness:.3 }), 0, .048, .004);
    return { g, paper };
  }

  /* ── Los tres ── */
  const mk = look => { const f = makeDentist(look); f.root.scale.setScalar(FIG); team.add(f.root); f.tools.brush.visible = f.tools.drill.visible = f.tools.mirror.visible = false; return f; };
  const A = { f:mk({ gown:'#5A9BE0', mask:'#A9D8F0', skin:SKINS[1], hair:HAIR[0], pants:'#21407A' }), yaw:0, yawT:0, phase:0, state:'idle', aim:null };
  const B = { f:mk({ gown:'#2BB596', mask:'#9FE3CF', skin:SKINS[2], hair:HAIR[2], glasses:true }), yaw:0, yawT:0, phase:0, state:'idle', aim:null };
  const C = { f:mk({ gown:'#5A9BE0', mask:'#A9D8F0', skin:SKINS[3], hair:HAIR[1], pants:'#21407A' }), yaw:0, yawT:0, phase:0, state:'idle', aim:null };
  const lamp = flashlight(A.f.arms[1].hand);
  magnifier(B.f.arms[1].hand);
  const board = clipboard(C.f.arms[0].hand);
  { const pen = add(C.f.arms[1].hand, new THREE.CylinderGeometry(.004, .004, .05, 6), plastic('#1E63C6'), 0, -.02, 0); }
  const crew = [A, B, C];

  /* posiciones fijas: A en la encía de abajo al frente, B sobre la lengua, C en el costado */
  const tongueTop = (x, z) => new THREE.Vector3(x, .2 + .42 * Math.sqrt(Math.max(0, 1 - (x / 1.2) ** 2 - ((z + .12) / 1.02) ** 2)) - .02, z);

  function* wait(s){ let t = 0; while (t < s) t += yield; }
  function* tween(dur, fn){ let t = 0; fn(0); while (t < dur){ t += yield; fn(Math.min(1, t / dur)); } }
  const faceTo = (w, p) => { const d = p.clone().sub(w.pos); w.yawT = Math.atan2(d.x, d.z); };

  /* A: alumbra los dientes de arriba, uno por uno, y avanza por la encía */
  function* scriptA(){
    const list = [12, 11, 21, 22, 13, 23].map(tooth);
    for (;;){
      for (const t of list){
        const th = THREE.MathUtils.clamp(t.th * .55, -.5, .5), to = gumStand(th, .27), from = A.pos.clone();
        A.state = 'walk'; faceTo(A, to); yield* tween(Math.max(.3, from.distanceTo(to) / .5), k => A.pos.lerpVectors(from, to, k));
        A.state = 'look'; faceTo(A, face(t)); mouth.setSpot(t);
        let tt = 0; while (tt < 1.5){ const dt = yield; tt += dt; A.aim = face(t).addScaledVector(archTangent(t.th), Math.sin(tt * 3) * .05); }
        hooks.tag && hooks.tag(face(t), verdict(t)); mouth.setSpot(null);
      }
    }
  }
  /* B: sobre la lengua, acerca la lupa a las muelas de cada lado */
  function* scriptB(){
    const list = [36, 35, 46, 45, 26, 16].map(tooth);
    for (;;){
      for (const t of list){
        const tgt = t.jaw ? face(t) : occlusal(t), sx = Math.sign(t.rest.x) * .42, to = tongueTop(sx, t.jaw ? .2 : .05), from = B.pos.clone();
        B.state = 'walk'; faceTo(B, to); yield* tween(Math.max(.3, from.distanceTo(to) / .45), k => { B.pos.lerpVectors(from, to, k); B.pos.y = tongueTop(B.pos.x, B.pos.z).y; });
        B.state = 'look'; faceTo(B, tgt);
        let tt = 0; while (tt < 1.7){ const dt = yield; tt += dt; B.aim = tgt.clone().add(new THREE.Vector3(Math.sin(tt * 2) * .03, Math.cos(tt * 2.6) * .03, 0)); B.lean = Math.sin(tt * 1.4) * .12; }
        hooks.tag && hooks.tag(tgt, verdict(t)); B.lean = 0;
      }
    }
  }
  /* C: anota, mira la boca, vuelve a anotar; de frente a la cámara */
  function* scriptC(){
    for (;;){ C.state = 'write'; C.yawT = .35; yield* wait(2.4); C.state = 'look'; C.yawT = -.6; yield* wait(1.2);
      C.state = 'nod'; C.yawT = .35; yield* wait(.9); }
  }

  let runs = [], started = false;
  function start(){
    A.pos = gumStand(-.3, .27); B.pos = tongueTop(.1, .05); C.pos = gumStand(1.0, .3);
    crew.forEach(w => { w.drop = 1.6 + Math.random() * .4; w.dropV = 0; });
    runs = [scriptA(), scriptB(), scriptC()]; runs.forEach(r => r.next()); started = true;
  }

  const _a = new THREE.Vector3();
  function pose(w, dt, time){
    const f = w.f, [hl, hr] = f.hips, [al, ar] = f.arms, kl = hl.userData.knee, kr = hr.userData.knee;
    let d = w.yawT - w.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); w.yaw += d * Math.min(1, dt * 8);
    // entrada: caen en su lugar con un rebote
    if (w.drop > 0 || w.dropV){ w.dropV -= 9 * dt; w.drop += w.dropV * dt; if (w.drop <= 0){ w.drop = 0; w.dropV = w.dropV < -1 ? -w.dropV * .25 : 0; } }
    f.root.position.copy(w.pos); f.root.position.y += w.drop; f.root.rotation.set(0, w.yaw, 0);
    w.phase += dt * (w.state === 'walk' ? 14 : 4); const s = Math.sin(w.phase);
    hl.rotation.set(0, 0, 0); hr.rotation.set(0, 0, 0); kl.rotation.x = kr.rotation.x = .05;
    al.sh.rotation.set(0, 0, .12); ar.sh.rotation.set(0, 0, -.12); al.el.rotation.x = ar.el.rotation.x = -.25;
    f.body.rotation.set(0, 0, 0); f.body.position.set(0, 0, 0); f.head.rotation.set(0, 0, 0);
    if (w.state === 'walk'){ hl.rotation.x = s * .6; hr.rotation.x = -s * .6; kl.rotation.x = .15 + Math.max(0, -Math.cos(w.phase)) * .8; kr.rotation.x = .15 + Math.max(0, Math.cos(w.phase)) * .8; al.sh.rotation.x = -s * .4; f.body.position.y = Math.abs(Math.cos(w.phase)) * .008; }
    if (w === C){
      // sostiene la tablilla con la izquierda y escribe con la derecha
      al.sh.rotation.set(-1, 0, .25); al.el.rotation.x = -1.1;
      if (w.state === 'write'){ ar.sh.rotation.set(-1.05 + Math.sin(time * 9) * .06, 0, -.35 + Math.sin(time * 13) * .05); ar.el.rotation.x = -1.05; f.head.rotation.x = .35; }
      else if (w.state === 'nod'){ f.head.rotation.x = Math.sin(time * 9) * .25; ar.sh.rotation.set(-.4, 0, -.15); }
      else { ar.sh.rotation.set(-.2, 0, -.15); f.head.rotation.y = -.3; }
    }
    if ((w === A || w === B) && w.state === 'look' && w.aim){
      _a.copy(w.aim); team.localToWorld(_a); f.root.worldToLocal(_a);
      const dir = _a.sub(ar.sh.position).normalize(); ar.sh.quaternion.setFromUnitVectors(DOWN, dir); ar.el.rotation.x = -.1;
      f.head.rotation.x = -dir.y * .5; if (w === B) f.body.rotation.x = .1 + (w.lean || 0);
      al.sh.rotation.set(-.3, 0, .3);
    }
    lamp.beam.visible = A.state === 'look';
    lamp.beam.material.opacity = .18 + Math.sin(time * 20) * .015;
  }

  let k = 0;
  function update(dt, time, active){
    k += ((active ? 1 : 0) - k) * Math.min(1, dt * 6);
    team.visible = k > .02; team.scale.setScalar(Math.max(.001, k));
    if (!active){ if (started && k < .03){ started = false; mouth.setSpot(null); } return; }
    if (!started) start();
    runs.forEach(r => r.next(dt));
    for (const w of crew) pose(w, dt, time);
  }
  const meshes = []; crew.forEach(w => w.f.root.traverse(o => { if (o.isMesh){ o.userData.examiner = w; meshes.push(o); } }));
  function poke(w){ if (!w.drop) w.dropV = 1.4, w.drop = .001; }
  return { team, update, meshes, poke };
}
