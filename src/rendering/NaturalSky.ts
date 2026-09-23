import * as THREE from 'three';

// Camera-centred atmosphere. Clouds are sampled in direction space, so they
// stay continuous across the sky without textures or extra render passes.
export class NaturalSky {
  private material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      daylight: { value: 1 },
      sunset: { value: 0 },
      elapsed: { value: 0 },
      sunDirection: { value: new THREE.Vector3(0, 1, 0) },
    },
    vertexShader: `
      varying vec3 direction;
      void main() {
        direction = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 direction;
      uniform float daylight, sunset, elapsed;
      uniform vec3 sunDirection;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        f = f*f*(3.0-2.0*f);
        return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),
          mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
      }
      void main() {
        vec3 d = normalize(direction);
        float height = pow(max(d.y, 0.0), 0.45);
        vec3 horizon = mix(vec3(0.025,0.035,0.07), vec3(0.64,0.79,0.81), daylight);
        vec3 zenith = mix(vec3(0.003,0.008,0.028), vec3(0.12,0.36,0.62), daylight);
        float towardsSun = pow(max(dot(d, sunDirection),0.0), 4.0);
        horizon = mix(horizon, vec3(0.91,0.30,0.09), sunset * (0.35 + 0.6*towardsSun));
        vec3 color = mix(horizon, zenith, height);
        float glow = pow(max(dot(d, sunDirection),0.0), 64.0);
        color += vec3(1.0,0.72,0.38)*glow*daylight*0.38;
        vec2 p = d.xz / max(d.y+0.18,0.05)*3.0 + vec2(elapsed*0.003,0);
        float n = noise(p)*0.6 + noise(p*2.1)*0.28 + noise(p*4.2)*0.12;
        float clouds = smoothstep(0.55,0.73,n) * smoothstep(0.03,0.22,d.y);
        vec3 cloudColor = mix(vec3(0.07,0.09,0.14),vec3(0.91,0.94,0.95),daylight);
        cloudColor = mix(cloudColor,vec3(0.77,0.46,0.32),sunset*0.65);
        color = mix(color,cloudColor*(0.82+n*0.18),clouds*0.94);
        gl_FragColor = vec4(color,1);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  private mesh: THREE.Mesh;

  constructor(scene: THREE.Scene, radius: number) {
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 24, 16), this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -100;
    scene.add(this.mesh);
  }

  update(dt: number, camera: THREE.Camera, daylight: number, sunset: number, sun: THREE.Vector3): void {
    this.mesh.position.copy(camera.position);
    this.material.uniforms.elapsed.value += dt;
    this.material.uniforms.daylight.value = daylight;
    this.material.uniforms.sunset.value = sunset;
    this.material.uniforms.sunDirection.value.copy(sun);
  }
}

