import * as THREE from 'three';

/* El cepillo que hace de cursor y la espuma que suelta al frotar. */
export function buildBrush(scene, overlay = scene){
  const brush = new THREE.Group(), body = new THREE.Group(); brush.add(body);
  const handleMat = new THREE.MeshPhysicalMaterial({ color:'#1E63C6', roughness:.25, clearcoat:1, clearcoatRoughness:.08, sheen:.3, sheenColor:new THREE.Color('#9CC8FF') });
  const gripMat = new THREE.MeshStandardMaterial({ color:'#4FB6E8', roughness:.75 });
  const headMat = new THREE.MeshPhysicalMaterial({ color:'#F6F8F7', roughness:.3, clearcoat:.8 });
  // las puntas de las cerdas están en el origen; el cepillo crece hacia +Y y el mango hacia +X
  const head = new THREE.Mesh(new THREE.CapsuleGeometry(.065, .24, 6, 16), headMat); head.rotation.z = Math.PI / 2; head.scale.set(.55, 1, 1); head.position.set(0, .17, 0); body.add(head);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(.03, .045, .36, 14), headMat); neck.rotation.z = Math.PI / 2 - .12; neck.position.set(.33, .2, 0); body.add(neck);
  const handle = new THREE.Mesh(new THREE.CapsuleGeometry(.07, 1.05, 8, 18), handleMat); handle.rotation.z = Math.PI / 2 - .1; handle.position.set(1.02, .28, 0); body.add(handle);
  const grip = new THREE.Mesh(new THREE.CapsuleGeometry(.074, .32, 6, 16), gripMat); grip.rotation.z = Math.PI / 2 - .1; grip.position.set(.82, .26, 0); body.add(grip);
  const COLS = 9, ROWS = 3;
  const bristles = new THREE.InstancedMesh(new THREE.CylinderGeometry(.016, .02, .14, 6), new THREE.MeshStandardMaterial({ roughness:.5 }), COLS * ROWS);
  { const m = new THREE.Matrix4(), c = new THREE.Color(); let i = 0;
    for (let a = 0; a < COLS; a++) for (let b = 0; b < ROWS; b++){
      m.makeTranslation(-.15 + a * .0375, .075 - (b === 1 ? .008 : 0), -.04 + b * .04); bristles.setMatrixAt(i, m);
      bristles.setColorAt(i, c.set(a % 3 === 1 ? '#4FB6E8' : '#FFFFFF')); i++; } }
  body.add(bristles);
  brush.traverse(o => { if (o.isMesh) o.castShadow = true; });
  brush.scale.setScalar(0); overlay.add(brush);   // el cepillo se dibuja encima de todo: nunca se esconde tras los labios

  /* espuma */
  const N = 260;
  const foamMat = new THREE.MeshPhysicalMaterial({ color:'#FFFFFF', roughness:.15, clearcoat:1, transmission:.35, thickness:.1, ior:1.33, transparent:true, opacity:.95 });
  const foam = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 12, 8), foamMat, N);
  foam.instanceMatrix.setUsage(THREE.DynamicDrawUsage); foam.frustumCulled = false; scene.add(foam);
  const bubbles = Array.from({ length:N }, () => ({ on:false, p:new THREE.Vector3(), v:new THREE.Vector3(), life:0, r:.03 }));
  let cursor = 0; const ZERO = new THREE.Matrix4().makeScale(0, 0, 0), M = new THREE.Matrix4(), Q = new THREE.Quaternion(), Sv = new THREE.Vector3();
  for (let i = 0; i < N; i++) foam.setMatrixAt(i, ZERO);
  function spawn(p, n, scale){
    const b = bubbles[cursor]; cursor = (cursor + 1) % N;
    b.on = true; b.life = 0; b.r = (.018 + Math.random() * .035) * scale;
    b.p.copy(p).add(new THREE.Vector3((Math.random() - .5) * .08, (Math.random() - .5) * .08, (Math.random() - .5) * .08).multiplyScalar(scale));
    b.v.copy(n).multiplyScalar(.25 + Math.random() * .35).add(new THREE.Vector3((Math.random() - .5) * .5, Math.random() * .3, (Math.random() - .5) * .5)).multiplyScalar(scale);
  }
  function clearFoam(){ for (const b of bubbles) b.on = false; }

  const pos = new THREE.Vector3(), quat = new THREE.Quaternion(), tgtPos = new THREE.Vector3(), tgtQ = new THREE.Quaternion();
  const X = new THREE.Vector3(), Y = new THREE.Vector3(), Z = new THREE.Vector3(), basis = new THREE.Matrix4();
  let shown = 0, first = true;
  /* aim: { point, normal } donde apoyar las cerdas; handleHint: hacia dónde va el mango */
  function update(dt, time, { visible, point, normal, handleHint, scale, scrubbing, speed }){
    tgtPos.copy(point);
    Y.copy(normal).normalize();
    X.copy(handleHint).addScaledVector(Y, -handleHint.dot(Y)).normalize();
    Z.crossVectors(X, Y).normalize();
    basis.makeBasis(X, Y, Z); tgtQ.setFromRotationMatrix(basis);
    if (first || shown < .05){ pos.copy(tgtPos); quat.copy(tgtQ); first = false; }
    const k = 1 - Math.exp(-dt * 22); pos.lerp(tgtPos, k); quat.slerp(tgtQ, 1 - Math.exp(-dt * 14));
    shown += ((visible ? 1 : 0) - shown) * Math.min(1, dt * 14);
    brush.position.copy(pos); brush.quaternion.copy(quat); brush.scale.setScalar(Math.max(.0001, shown * scale));
    // al frotar el cepillo vibra de lado a lado
    const wig = scrubbing ? Math.sin(time * 38) * .025 * Math.min(1, speed) : 0;
    body.position.set(wig, 0, 0); body.rotation.set(0, 0, scrubbing ? -.06 : 0);
    // espuma
    for (let i = 0; i < N; i++){ const b = bubbles[i];
      if (!b.on){ foam.setMatrixAt(i, ZERO); continue; }
      b.life += dt; b.v.multiplyScalar(1 - Math.min(1, dt * 3)); b.v.y -= .25 * dt; b.p.addScaledVector(b.v, dt);
      const s = b.r * Math.min(1, b.life * 8) * Math.max(0, 1 - Math.max(0, b.life - 1.1) / .5);
      if (b.life > 1.6){ b.on = false; foam.setMatrixAt(i, ZERO); continue; }
      M.compose(b.p, Q, Sv.setScalar(s)); foam.setMatrixAt(i, M); }
    foam.instanceMatrix.needsUpdate = true;
  }
  return { brush, update, spawn, clearFoam, tip:() => pos };
}
