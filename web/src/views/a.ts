// View A, the tilted plane: one ground plane, the camera fixed at about 50 degrees, drag pans,
// scroll zooms, no rotation.
import * as THREE from "three";
import { W, flat, type ViewModule } from "./view";

export const viewA: ViewModule = {
  setup(camera, controls) {
    const tilt = THREE.MathUtils.degToRad(50),
      d = 95;
    camera.position.set(0, Math.sin(tilt) * d, Math.cos(tilt) * d);
    controls.enableRotate = false;
    controls.screenSpacePanning = false; // pan along the ground plane
    controls.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
    controls.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_PAN }; // a finger drags as the mouse does
    controls.minDistance = 20;
    controls.maxDistance = 250; // the nearest names are past the label fade at the farthest zoom
  },
  decorate() {
    const grid = new THREE.PolarGridHelper(40, 6, 4, 96, 0x3a4060, 0x262a3c);
    Object.assign(grid.material, { transparent: true, opacity: 0.6 });
    return grid;
  },
  place: {
    focus: () => new THREE.Vector3(),
    ring1: (a, pos) => flat(a, 17 + (pos % 2) * 4),
    ring2: (a, rank) => flat(a, 32 + rank * 2.5),
    path: (i) => new THREE.Vector3(-50 - i * 6, 0, 14 + i * 2),
    pin: (i) => new THREE.Vector3(-26 + i * 26, 0, -62),
    pinRing: (p, typeIndex, rank) => p.clone().add(flat(-Math.PI / 2 + typeIndex * W + (rank - 1) * 0.3, 8)),
  },
};
