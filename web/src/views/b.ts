// View B, stacked discs: the Focus on top, Ring 1 on the disc below, Ring 2 on the lowest disc.
// Drag spins about the vertical axis, scroll zooms.
import * as THREE from "three";
import { W, flat, type ViewModule } from "./view";

// Wide rings and a camera 45 degrees from the vertical keep Ring 1 and its labels clear of the Focus.
const TOP = 10,
  LOW = -14,
  R1 = 28,
  R2 = 44;

export const viewB: ViewModule = {
  setup(camera, controls) {
    const polar = THREE.MathUtils.degToRad(45),
      d = 115;
    camera.position.set(0, Math.cos(polar) * d, Math.sin(polar) * d);
    controls.enablePan = false;
    controls.minPolarAngle = controls.maxPolarAngle = polar; // a turntable: no tilting
    controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
    controls.minDistance = 25;
    controls.maxDistance = 260; // the front row of Ring 1 is past the label fade at the farthest zoom
  },
  decorate() {
    const g = new THREE.Group();
    for (const [y, r] of [
      [0, R1 + 8],
      [LOW, R2 + 12],
    ]) {
      const disc = new THREE.Mesh(
        new THREE.CircleGeometry(r, 96),
        new THREE.MeshBasicMaterial({ color: 0x8090c0, transparent: true, opacity: 0.06, side: THREE.DoubleSide, depthWrite: false }),
      );
      disc.rotation.x = -Math.PI / 2;
      disc.position.y = y;
      const rim = new THREE.LineLoop(
        new THREE.BufferGeometry().setFromPoints(Array.from({ length: 96 }, (_, i) => flat((i / 96) * Math.PI * 2, r, y))),
        new THREE.LineBasicMaterial({ color: 0x5a6390, transparent: true, opacity: 0.5 }),
      );
      g.add(disc, rim);
    }
    const axis = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, LOW, 0), new THREE.Vector3(0, TOP, 0)]),
      new THREE.LineBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.25 }),
    );
    return g.add(axis);
  },
  centreFrom: (p, centre) => new THREE.Vector3(p.x, centre.y, p.z), // the discs keep their height
  place: {
    focus: () => new THREE.Vector3(0, TOP, 0),
    ring1: (a, pos) => flat(a, R1 + (pos % 2) * 5),
    ring2: (a, rank) => flat(a, R2 + rank * 3, LOW),
    path: (i) => new THREE.Vector3(-(7 + i * 6), TOP + (i + 1) * 3, 0),
    pin: (i) => flat(-Math.PI / 2 + (i - 1) * 0.8, 60, TOP),
    pinRing: (p, typeIndex, rank) => p.clone().add(flat(-Math.PI / 2 + typeIndex * W + (rank - 1) * 0.3, 8, -4)),
  },
};
