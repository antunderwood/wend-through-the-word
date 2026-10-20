// View C, free orbit: a 3D layout, drag orbits, right drag pans, scroll zooms. No decoration.
import * as THREE from "three";
import { W, type ViewModule } from "./view";

// A point on a sphere of radius r, at azimuth az and the given elevation.
const sph = (az: number, elevation: number, r: number) =>
  new THREE.Vector3(Math.cos(elevation) * Math.cos(az) * r, Math.sin(elevation) * r, Math.cos(elevation) * Math.sin(az) * r);

export const viewC: ViewModule = {
  setup(camera, controls) {
    // At elevation 0.75, so the line of sight behind the Focus passes well below the lowest Ring 1
    // band (-0.4); at 0.45 the first Person sat right behind the Focus.
    camera.position.set(24, 63, 63);
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
    // Behind Ring 2, so the pins and their rings show above the scene from the start camera.
    pin: (i) => new THREE.Vector3(-30 + i * 22, 0, -44),
    pinRing: (p, typeIndex, rank) => p.clone().add(sph(-Math.PI / 2 + typeIndex * W + (rank - 1) * 0.3, (rank - 1) * 0.5, 8)),
  },
};
