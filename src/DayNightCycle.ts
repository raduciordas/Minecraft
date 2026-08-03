import * as THREE from 'three';
import {
  FULL_DAY_SECONDS,
  DAY_SECONDS,
  DAY_START_TIME,
  FREEZE_DAY_NIGHT,
  RENDER_DISTANCE,
  CHUNK_SIZE,
} from './config';

const DAY_SKY = new THREE.Color(0x87ceeb);
const SUNSET_SKY = new THREE.Color(0xe8875a);
const NIGHT_SKY = new THREE.Color(0x070b21);

const STAR_COUNT = 350;

// Share of the cycle spent in daylight. The sun still travels the same arc,
// it just takes longer to cross it than the moon does.
const DAY_PHASE = DAY_SECONDS / FULL_DAY_SECONDS;

// `phase` runs 0..1 at a constant rate from sunrise, and is what the clock
// actually advances. `time` is the sky position it maps to — still the old
// convention (0 = midnight, 0.25 = sunrise, 0.5 = noon, 0.75 = sunset), so
// every reader downstream, and every saved world, keeps working unchanged.
// The map is piecewise-linear: the day half of the sky (0.25 → 0.75) is
// stretched over DAY_PHASE of the clock, the night half over the rest.
function phaseToTime(phase: number): number {
  const p = ((phase % 1) + 1) % 1;
  if (p < DAY_PHASE) return 0.25 + (p / DAY_PHASE) * 0.5;
  return (0.75 + ((p - DAY_PHASE) / (1 - DAY_PHASE)) * 0.5) % 1;
}

function timeToPhase(time: number): number {
  const t = ((time % 1) + 1) % 1;
  if (t >= 0.25 && t < 0.75) return ((t - 0.25) / 0.5) * DAY_PHASE;
  const nightT = t < 0.25 ? t + 1 : t; // the night arc wraps past midnight
  return DAY_PHASE + ((nightT - 0.75) / 0.5) * (1 - DAY_PHASE);
}

export class DayNightCycle {
  private phase = timeToPhase(DAY_START_TIME);

  // Where the sun sits in the sky, derived from the clock. Assigning it
  // (a loaded save, a test) rewinds the clock to match.
  get time(): number {
    return phaseToTime(this.phase);
  }
  set time(value: number) {
    this.phase = timeToPhase(value);
  }

  // When set (multiplayer), time is derived from wall-clock time relative to
  // this epoch instead of accumulated locally, so every connected player
  // sees the same sky.
  private networkEpoch: number | null = null;

  private sun: THREE.Sprite;
  private moon: THREE.Sprite;
  private stars: THREE.Points;
  private starsMaterial: THREE.PointsMaterial;
  private skyColor = new THREE.Color();
  private sunDir = new THREE.Vector3();
  private skyRadius = RENDER_DISTANCE * CHUNK_SIZE * 0.9;

  constructor(
    private scene: THREE.Scene,
    private ambient: THREE.AmbientLight,
    private directional: THREE.DirectionalLight,
  ) {
    this.sun = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xfff3a0, fog: false }));
    this.sun.scale.setScalar(14);
    scene.add(this.sun);

    this.moon = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xd8dce8, fog: false }));
    this.moon.scale.setScalar(9);
    scene.add(this.moon);

    const positions = new Float32Array(STAR_COUNT * 3);
    for (let i = 0; i < STAR_COUNT; i++) {
      // Random directions on the upper hemisphere
      const theta = Math.random() * Math.PI * 2;
      const y = 0.05 + Math.random() * 0.95;
      const r = Math.sqrt(1 - y * y);
      positions[i * 3] = Math.cos(theta) * r * this.skyRadius;
      positions[i * 3 + 1] = y * this.skyRadius;
      positions[i * 3 + 2] = Math.sin(theta) * r * this.skyRadius;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    this.starsMaterial = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 1.6,
      sizeAttenuation: false,
      transparent: true,
      opacity: 0,
      fog: false,
    });
    this.stars = new THREE.Points(starGeo, this.starsMaterial);
    scene.add(this.stars);
  }

  // Sun elevation: 1 at noon, -1 at midnight
  private get elevation(): number {
    return Math.sin((this.time - 0.25) * Math.PI * 2);
  }

  // 0 = full night, 1 = full day
  get daylight(): number {
    const t = (this.elevation + 0.05) / 0.25;
    return Math.max(0, Math.min(1, t));
  }

  get isNight(): boolean {
    return this.elevation < 0;
  }

  setNetworkEpoch(epochMs: number): void {
    this.networkEpoch = epochMs;
  }

  update(dt: number, camera: THREE.Camera): void {
    if (FREEZE_DAY_NIGHT) {
      this.phase = timeToPhase(DAY_START_TIME);
    } else if (this.networkEpoch !== null) {
      const elapsedSeconds = (Date.now() - this.networkEpoch) / 1000;
      const start = timeToPhase(DAY_START_TIME);
      this.phase = (((elapsedSeconds / FULL_DAY_SECONDS + start) % 1) + 1) % 1;
    } else {
      this.phase = (this.phase + dt / FULL_DAY_SECONDS) % 1;
    }

    const angle = (this.time - 0.25) * Math.PI * 2;
    this.sunDir.set(Math.cos(angle), Math.sin(angle), 0.35).normalize();

    const daylight = this.daylight;
    this.ambient.intensity = 0.18 + 0.52 * daylight;
    this.directional.intensity = 0.08 + 0.82 * daylight;
    this.directional.position.copy(this.sunDir).multiplyScalar(100);

    // Sky: night <-> day, tinted orange near the horizon
    this.skyColor.lerpColors(NIGHT_SKY, DAY_SKY, daylight);
    const sunsetStrength = Math.max(0, 1 - Math.abs(this.elevation) / 0.28);
    this.skyColor.lerp(SUNSET_SKY, sunsetStrength * 0.6);
    (this.scene.background as THREE.Color).copy(this.skyColor);
    (this.scene.fog as THREE.Fog).color.copy(this.skyColor);

    // Celestial bodies ride along with the camera at the fog boundary
    this.sun.position.copy(camera.position).addScaledVector(this.sunDir, this.skyRadius);
    this.moon.position.copy(camera.position).addScaledVector(this.sunDir, -this.skyRadius);
    this.stars.position.copy(camera.position);
    this.starsMaterial.opacity = Math.max(0, 1 - daylight * 1.6);
    this.stars.visible = this.starsMaterial.opacity > 0.02;
  }
}
