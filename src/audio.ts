/**
 * Web Audio API synthesizer for jet engine, beeps, and flyby sounds.
 */

class SoundEffectsController {
  private ctx: AudioContext | null = null;
  private ambientHumSource: OscillatorNode | null = null;
  private ambientHumFilter: BiquadFilterNode | null = null;
  private ambientHumGain: GainNode | null = null;
  private isHumming = false;

  constructor() {
    // Lazy initialize to bypass auto-play restrictions
  }

  private initContext() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  /**
   * High pitch tactical radar sweep or button click beep
   */
  public playBeep(frequency = 1200, duration = 0.08, type: OscillatorType = 'sine') {
    try {
      this.initContext();
      if (!this.ctx) return;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(frequency, this.ctx.currentTime);
      
      // Decay gain quickly
      gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {
      console.warn('Audio play failure:', e);
    }
  }

  /**
   * Plays a sequence of diagnostic radar beeps typical of an F-18 cockpit check
   */
  public playCockpitCheckBeeps() {
    try {
      this.initContext();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      [0, 0.15, 0.3, 0.45].forEach((delay, index) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();

        osc.type = 'sine';
        // Alternating pitches
        osc.frequency.setValueAtTime(index % 2 === 0 ? 880 : 1760, now + delay);
        
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.1, now + delay + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.08);

        osc.connect(gain);
        gain.connect(this.ctx!.destination);

        osc.start(now + delay);
        osc.stop(now + delay + 0.1);
      });
    } catch (e) {
      console.warn('Audio check failure:', e);
    }
  }

  /**
   * Jet Flyby sounds: white noise sweep with lowpass filter
   */
  public playJetFlyby() {
    try {
      this.initContext();
      if (!this.ctx) return;

      const duration = 2.5;
      const now = this.ctx.currentTime;

      // 1. White Nose Buffer Source
      const bufferSize = this.ctx.sampleRate * duration;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noiseNode = this.ctx.createBufferSource();
      noiseNode.buffer = buffer;

      // 2. Lowpass Filter with active sweep
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.Q.value = 5.0;
      
      // Sweep frequency up then down sharply
      filter.frequency.setValueAtTime(200, now);
      filter.frequency.exponentialRampToValueAtTime(1800, now + 1.1); // Peak whoosh as plane passes
      filter.frequency.exponentialRampToValueAtTime(100, now + duration);

      // 3. Gain sweep for Doppler effect
      const gainNode = this.ctx.createGain();
      gainNode.gain.setValueAtTime(0.001, now);
      gainNode.gain.exponentialRampToValueAtTime(0.4, now + 1.1); // Peak loudness
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration);

      // Connect nodes
      noiseNode.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(this.ctx.destination);

      noiseNode.start(now);
      noiseNode.stop(now + duration);

      // 4. Low roaring undertone using low oscillator
      const osc = this.ctx.createOscillator();
      const oscGain = this.ctx.createGain();
      osc.type = 'sawtooth';
      
      // Doppler pitch shift
      osc.frequency.setValueAtTime(80, now);
      osc.frequency.linearRampToValueAtTime(95, now + 1.0);
      osc.frequency.linearRampToValueAtTime(45, now + duration);

      // Lowpass on saw oscillator
      const oscFilter = this.ctx.createBiquadFilter();
      oscFilter.type = 'lowpass';
      oscFilter.frequency.setValueAtTime(150, now);

      oscGain.gain.setValueAtTime(0.001, now);
      oscGain.gain.exponentialRampToValueAtTime(0.25, now + 1.1);
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      osc.connect(oscFilter);
      oscFilter.connect(oscGain);
      oscGain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + duration);
    } catch (e) {
      console.warn('Audio flyby failure:', e);
    }
  }

  /**
   * Takeoff Engine ignition and massive acceleration roar
   */
  public playTakeoffRoar(onComplete?: () => void) {
    try {
      this.initContext();
      if (!this.ctx) {
        if (onComplete) onComplete();
        return;
      }

      const duration = 3.5;
      const now = this.ctx.currentTime;

      // Noise source (for wind shear/turbine flow)
      const bufferSize = this.ctx.sampleRate * duration;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noiseNode = this.ctx.createBufferSource();
      noiseNode.buffer = buffer;

      const noiseFilter = this.ctx.createBiquadFilter();
      noiseFilter.type = 'bandpass';
      noiseFilter.Q.value = 3.0;
      noiseFilter.frequency.setValueAtTime(250, now);
      noiseFilter.frequency.exponentialRampToValueAtTime(2200, now + 2.5); // Accel roar

      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.001, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.4, now + 2.2);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      noiseNode.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(this.ctx.destination);

      // Low-end engines (Saw/Square waves mixing to create rumbling thrust)
      const osc1 = this.ctx.createOscillator();
      const osc1Gain = this.ctx.createGain();
      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(55, now);
      osc1.frequency.exponentialRampToValueAtTime(140, now + 2.5);

      const osc2 = this.ctx.createOscillator();
      const osc2Gain = this.ctx.createGain();
      osc2.type = 'square';
      osc2.frequency.setValueAtTime(55.5, now); // slightly detuned for chorus thickness
      osc2.frequency.exponentialRampToValueAtTime(142, now + 2.5);

      const lowpass = this.ctx.createBiquadFilter();
      lowpass.type = 'lowpass';
      lowpass.frequency.setValueAtTime(120, now);
      lowpass.frequency.exponentialRampToValueAtTime(450, now + 2.5);

      const rumbleGain = this.ctx.createGain();
      rumbleGain.gain.setValueAtTime(0.001, now);
      rumbleGain.gain.exponentialRampToValueAtTime(0.45, now + 2.2);
      rumbleGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      osc1.connect(lowpass);
      osc2.connect(lowpass);
      lowpass.connect(rumbleGain);
      rumbleGain.connect(this.ctx.destination);

      noiseNode.start(now);
      osc1.start(now);
      osc2.start(now);

      noiseNode.stop(now + duration);
      osc1.stop(now + duration);
      osc2.stop(now + duration);

      if (onComplete) {
        setTimeout(onComplete, duration * 1000 - 300);
      }
    } catch (e) {
      console.warn('Takeoff audio fail:', e);
      if (onComplete) onComplete();
    }
  }

  /**
   * Starts constant background jet cockpit ambient hum
   */
  public startAmbientHum() {
    if (this.isHumming) return;
    try {
      this.initContext();
      if (!this.ctx) return;

      this.isHumming = true;

      this.ambientHumSource = this.ctx.createOscillator();
      this.ambientHumFilter = this.ctx.createBiquadFilter();
      this.ambientHumGain = this.ctx.createGain();

      this.ambientHumSource.type = 'sawtooth';
      this.ambientHumSource.frequency.setValueAtTime(45, this.ctx.currentTime); // 45 Hz low end rumble

      this.ambientHumFilter.type = 'lowpass';
      this.ambientHumFilter.frequency.setValueAtTime(110, this.ctx.currentTime);

      // Low level background sound (barely noticeable hum)
      this.ambientHumGain.gain.setValueAtTime(0.04, this.ctx.currentTime);

      this.ambientHumSource.connect(this.ambientHumFilter);
      this.ambientHumFilter.connect(this.ambientHumGain);
      this.ambientHumGain.connect(this.ctx.destination);

      this.ambientHumSource.start();
    } catch (e) {
      console.warn('Ambient play fail:', e);
    }
  }

  /**
   * Stops ambient hum
   */
  public stopAmbientHum() {
    if (!this.isHumming) return;
    try {
      if (this.ambientHumSource) {
        this.ambientHumSource.stop();
        this.ambientHumSource.disconnect();
        this.ambientHumSource = null;
      }
      if (this.ambientHumFilter) {
        this.ambientHumFilter.disconnect();
        this.ambientHumFilter = null;
      }
      if (this.ambientHumGain) {
        this.ambientHumGain.disconnect();
        this.ambientHumGain = null;
      }
      this.isHumming = false;
    } catch (e) {
      console.warn('Ambient halt fail:', e);
    }
  }
}

export const sfx = new SoundEffectsController();
