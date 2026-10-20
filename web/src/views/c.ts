// View C, free orbit: a 3D layout, drag orbits, right drag pans, scroll zooms. No decoration.
import * as THREE from "three";
import { W, type ViewModule } from "./view";

// A point at azimuth az and elevation el on a sphere of radius r.
const sph = (az: number, el: number, r: number) =>
  new THREE.Vector3(Math.cos(el) * Math.cos(az) * r, Math.sin(el) * r, Math.cos(el) * Math.sin(az) * r);

export const viewC: ViewModule = {
  setup(camera, controls) {
    camera.position.set(30, 40, 78);
    controls.minDistance = 15;
    controls.maxDistance = 260;
  },
  decorate: () => new THREE.Group(),
  fog: true,
  place: {
    focus: () => new THREE.Vector3(),
    ring1: (a, pos) => sph(a, ((pos % 3) - 1) * 0.4, 16 + (pos % 2) * 3),
    // Ring 2 keeps its parent's elevation.
    ring2: (a, rank, parent) => sph(a, Math.asin(parent.y / parent.length()) + (rank - 1) * 0.14, 31 + rank * 2),
    path: (i) => new THREE.Vector3(-1, -0.7, -0.8).normalize().multiplyScalar(44 + i * 5),
    pin: (i) => new THREE.Vector3(-26 + i * 26, 34, -24),
    pinRing: (p, ti, rank) => p.clone().add(sph(-Math.PI / 2 + ti * W + (rank - 1) * 0.3, (rank - 1) * 0.5, 8)),
  },
};
