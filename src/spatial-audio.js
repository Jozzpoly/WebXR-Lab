import * as THREE from 'three';

export class SpatialSynth {
  constructor(camera, scene) {
    this.scene = scene;
    this.listener = new THREE.AudioListener();
    camera.add(this.listener);
    this.context = this.listener.context;
    this.buffers = {
      shot: this.makeBuffer({ duration: 0.11, startHz: 520, endHz: 150, noise: 0.08, decay: 14 }),
      hit: this.makeBuffer({ duration: 0.09, startHz: 880, endHz: 330, noise: 0.16, decay: 18 }),
      explosion: this.makeBuffer({ duration: 0.34, startHz: 170, endHz: 48, noise: 0.72, decay: 8 }),
      coreHit: this.makeBuffer({ duration: 0.28, startHz: 120, endHz: 62, noise: 0.28, decay: 7 }),
      grab: this.makeBuffer({ duration: 0.08, startHz: 260, endHz: 420, noise: 0.03, decay: 16 })
    };
  }

  makeBuffer({ duration, startHz, endHz, noise = 0, decay = 10 }) {
    const sampleRate = this.context.sampleRate || 48000;
    const length = Math.max(1, Math.floor(sampleRate * duration));
    const buffer = this.context.createBuffer(1, length, sampleRate);
    const channel = buffer.getChannelData(0);
    let phase = 0;

    for (let i = 0; i < length; i++) {
      const t = i / Math.max(1, length - 1);
      const frequency = startHz + (endHz - startHz) * t;
      phase += (Math.PI * 2 * frequency) / sampleRate;
      const envelope = Math.exp(-decay * t) * Math.min(1, t * 45);
      const tonal = Math.sin(phase) * (1 - noise);
      const noisy = (Math.random() * 2 - 1) * noise;
      channel[i] = (tonal + noisy) * envelope * 0.72;
    }
    return buffer;
  }

  unlock() {
    try {
      if (this.context.state === 'suspended') {
        const result = this.context.resume();
        result?.catch?.(() => {});
      }
    } catch {
      // Audio is optional feedback and must never block gameplay.
    }
  }

  play(name, worldPosition, volume = 0.55, refDistance = 1.2) {
    try {
      this.unlock();
      const buffer = this.buffers[name];
      if (!buffer) return;
      const audio = new THREE.PositionalAudio(this.listener);
      audio.setBuffer(buffer);
      audio.setVolume(volume);
      audio.setRefDistance(refDistance);
      audio.setRolloffFactor(1.35);
      audio.setDistanceModel('inverse');
      audio.position.copy(worldPosition);
      this.scene.add(audio);
      audio.play();
      if (audio.source) {
        audio.source.onended = () => {
          audio.disconnect();
          this.scene.remove(audio);
        };
      }
    } catch {
      // Keep the primary interaction path independent from WebAudio state.
    }
  }

  shot(position) { this.play('shot', position, 0.36, 0.9); }
  hit(position) { this.play('hit', position, 0.4, 1.0); }
  explosion(position, elite = false) { this.play('explosion', position, elite ? 0.78 : 0.58, 1.3); }
  coreHit(position) { this.play('coreHit', position, 0.72, 1.25); }
  grab(position) { this.play('grab', position, 0.3, 0.65); }
}
