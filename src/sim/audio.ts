// Procedural Web Audio API synthesizer for V1 feedback & authentic 1990 French ATM hardware acoustics

class SoundSynthesizer {
  private ctx: AudioContext | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private pcFanSource: AudioBufferSourceNode | null = null;
  private pcFanGain: GainNode | null = null;

  private ensureContext(): AudioContext | null {
    try {
      const AudioCtor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtor) return null;
      if (!this.ctx) {
        this.ctx = new AudioCtor();
      }
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return this.ctx;
    } catch {
      return null;
    }
  }

  private getNoiseBuffer(ctx: AudioContext): AudioBuffer {
    if (this.noiseBuffer && this.noiseBuffer.sampleRate === ctx.sampleRate) {
      return this.noiseBuffer;
    }
    const len = Math.floor(ctx.sampleRate * 0.5);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    this.noiseBuffer = buffer;
    return buffer;
  }

  playUiTone(isDoor: boolean): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = isDoor ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(isDoor ? 210 : 520, now);
    osc.frequency.exponentialRampToValueAtTime(isDoor ? 140 : 680, now + 0.08);
    gain.gain.setValueAtTime(0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.095);
  }

  playAtmPiezo(kind: 'digit' | 'bezel' | 'correct' | 'cancel' | 'confirm' | 'error'): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const emitTone = (freq: number, startOffset: number, dur: number, vol = 0.065, wave: OscillatorType = 'square') => {
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      osc.type = wave;
      osc.frequency.setValueAtTime(freq, now + startOffset);
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(freq, now + startOffset);
      filter.Q.value = 3.0;

      gain.gain.setValueAtTime(0.0001, now + startOffset);
      gain.gain.linearRampToValueAtTime(vol, now + startOffset + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.0008, now + startOffset + dur);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + startOffset);
      osc.stop(now + startOffset + dur + 0.01);
    };

    switch (kind) {
      case 'digit':
        emitTone(1860, 0, 0.055, 0.06, 'square');
        break;
      case 'bezel':
        emitTone(1620, 0, 0.06, 0.06, 'square');
        break;
      case 'correct':
        emitTone(1180, 0, 0.07, 0.06, 'square');
        break;
      case 'cancel':
        emitTone(620, 0, 0.09, 0.07, 'sawtooth');
        emitTone(440, 0.1, 0.13, 0.07, 'sawtooth');
        break;
      case 'confirm':
        emitTone(1860, 0, 0.055, 0.06, 'square');
        emitTone(2340, 0.065, 0.08, 0.065, 'square');
        break;
      case 'error':
        emitTone(320, 0, 0.14, 0.08, 'sawtooth');
        emitTone(280, 0.17, 0.18, 0.08, 'sawtooth');
        break;
    }
  }

  // Motorized 1990 card reader pull-in ("vrrrr-clac")
  playCardMotorPull(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Electric roller hum ("vrrrr")
    const motor = ctx.createOscillator();
    const motorGain = ctx.createGain();
    motor.type = 'sawtooth';
    motor.frequency.setValueAtTime(115, now);
    motor.frequency.linearRampToValueAtTime(148, now + 0.34);
    motorGain.gain.setValueAtTime(0.001, now);
    motorGain.gain.linearRampToValueAtTime(0.055, now + 0.04);
    motorGain.gain.linearRampToValueAtTime(0.045, now + 0.32);
    motorGain.gain.exponentialRampToValueAtTime(0.001, now + 0.42);

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 480;
    motor.connect(lp);
    lp.connect(motorGain);
    motorGain.connect(ctx.destination);
    motor.start(now);
    motor.stop(now + 0.44);

    // Solenoid latch click ("clac")
    const click = ctx.createBufferSource();
    click.buffer = this.getNoiseBuffer(ctx);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1400;
    const cGain = ctx.createGain();
    cGain.gain.setValueAtTime(0.0001, now + 0.35);
    cGain.gain.linearRampToValueAtTime(0.11, now + 0.36);
    cGain.gain.exponentialRampToValueAtTime(0.001, now + 0.41);
    click.connect(bp);
    bp.connect(cGain);
    cGain.connect(ctx.destination);
    click.start(now + 0.35);
    click.stop(now + 0.42);
  }

  // Card ejection whir
  playCardEject(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const motor = ctx.createOscillator();
    const gain = ctx.createGain();
    motor.type = 'sawtooth';
    motor.frequency.setValueAtTime(145, now);
    motor.frequency.linearRampToValueAtTime(110, now + 0.28);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 520;
    gain.gain.setValueAtTime(0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    motor.connect(lp);
    lp.connect(gain);
    gain.connect(ctx.destination);
    motor.start(now);
    motor.stop(now + 0.32);
  }

  // Authentic urgent 1990 French ATM forgotten-card reminder beep
  playForgottenCardBeep(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    [0, 0.14].forEach((offset) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(2480, now + offset);
      gain.gain.setValueAtTime(0.055, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.0008, now + offset + 0.085);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + offset);
      osc.stop(now + offset + 0.095);
    });
  }

  // Mechanical 1990 bill-dispenser / counter rollers ("tk-tk-tk-vrrr")
  playBillDispenserRollers(billCount = 4): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const noise = this.getNoiseBuffer(ctx);
    const steps = Math.max(3, Math.min(8, billCount + 2));

    // Rapid mechanical "tk-tk-tk" bill picker clicks
    for (let i = 0; i < steps; i++) {
      const t = now + i * 0.095;
      const src = ctx.createBufferSource();
      src.buffer = noise;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1850;
      bp.Q.value = 2.2;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.09, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.045);
      src.connect(bp);
      bp.connect(g);
      g.connect(ctx.destination);
      src.start(t);
      src.stop(t + 0.05);
    }

    // Motorized steel shutter opening & transport ("vrrrr")
    const shutterStart = now + steps * 0.095;
    const motor = ctx.createOscillator();
    const lp = ctx.createBiquadFilter();
    const mg = ctx.createGain();
    motor.type = 'sawtooth';
    motor.frequency.setValueAtTime(98, shutterStart);
    motor.frequency.linearRampToValueAtTime(132, shutterStart + 0.35);
    lp.type = 'lowpass';
    lp.frequency.value = 420;
    mg.gain.setValueAtTime(0.06, shutterStart);
    mg.gain.exponentialRampToValueAtTime(0.001, shutterStart + 0.42);
    motor.connect(lp);
    lp.connect(mg);
    mg.connect(ctx.destination);
    motor.start(shutterStart);
    motor.stop(shutterStart + 0.44);
  }

  // 1990 thermal / dot-matrix receipt printer zip
  playReceiptPrint(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    for (let i = 0; i < 6; i++) {
      const t = now + i * 0.075;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(620 + (i % 2) * 180, t);
      gain.gain.setValueAtTime(0.035, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.055);
    }
  }

  playPaperGrab(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.getNoiseBuffer(ctx);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 1600;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.07, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    src.connect(hp);
    hp.connect(gain);
    gain.connect(ctx.destination);
    src.start(now);
    src.stop(now + 0.11);
  }

  // Heavy 1990 industrial push-button microswitch click
  playMechanicalButtonClick(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const src = ctx.createBufferSource();
    src.buffer = this.getNoiseBuffer(ctx);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2100;
    bp.Q.value = 2.6;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.11, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.032);
    src.connect(bp);
    bp.connect(g);
    g.connect(ctx.destination);
    src.start(now);
    src.stop(now + 0.04);

    // Subtle solenoid thump
    const thump = ctx.createOscillator();
    const tg = ctx.createGain();
    thump.type = 'triangle';
    thump.frequency.setValueAtTime(240, now);
    thump.frequency.exponentialRampToValueAtTime(95, now + 0.045);
    tg.gain.setValueAtTime(0.06, now);
    tg.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    thump.connect(tg);
    tg.connect(ctx.destination);
    thump.start(now);
    thump.stop(now + 0.055);
  }

  // Bill validator reject motor reverse + low buzzer
  playBillReject(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const buzz = ctx.createOscillator();
    const bg = ctx.createGain();
    buzz.type = 'sawtooth';
    buzz.frequency.setValueAtTime(210, now);
    buzz.frequency.setValueAtTime(175, now + 0.14);
    bg.gain.setValueAtTime(0.06, now);
    bg.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
    buzz.connect(bg);
    bg.connect(ctx.destination);
    buzz.start(now);
    buzz.stop(now + 0.3);
  }

  // Realistic metallic cascade of clinking 1990 French Franc coins hitting stainless tray
  playCoinCascade(coinCount = 12): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const clinks = Math.max(6, Math.min(26, coinCount));

    for (let i = 0; i < clinks; i++) {
      // Slightly uneven natural hopper drop rhythm
      const t = now + 0.08 + i * 0.058 + (Math.random() - 0.5) * 0.018;
      // Inharmonic metallic bell partials (2.9kHz - 6.8kHz)
      const baseFreq = 2950 + Math.random() * 1900;
      const harmonicFreq = baseFreq * (1.42 + Math.random() * 0.22);

      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const g = ctx.createGain();

      osc1.type = 'sine';
      osc2.type = 'triangle';
      osc1.frequency.setValueAtTime(baseFreq, t);
      osc2.frequency.setValueAtTime(harmonicFreq, t);

      const peak = 0.036 + Math.random() * 0.022;
      const decay = 0.085 + Math.random() * 0.075;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(peak, t + 0.003);
      g.gain.exponentialRampToValueAtTime(0.0006, t + decay);

      osc1.connect(g);
      osc2.connect(g);
      g.connect(ctx.destination);

      osc1.start(t);
      osc2.start(t);
      osc1.stop(t + decay + 0.01);
      osc2.stop(t + decay + 0.01);
    }

    // Final settling metallic clatter in the stainless cup
    const settleT = now + 0.1 + clinks * 0.058;
    for (let j = 0; j < 4; j++) {
      const t = settleT + j * 0.045;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(3600 + j * 420 + Math.random() * 300, t);
      g.gain.setValueAtTime(0.028, t);
      g.gain.exponentialRampToValueAtTime(0.0005, t + 0.065);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.075);
    }
  }

  // Collecting coins from steel tray into coin pouch
  playCoinCollect(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const freqs = [3400, 4250, 5120, 3880, 4760];
    freqs.forEach((f, idx) => {
      const t = now + idx * 0.036;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, t);
      g.gain.setValueAtTime(0.045, t);
      g.gain.exponentialRampToValueAtTime(0.0007, t + 0.09);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.1);
    });
  }

  // Authentic 1990 supermarket laser barcode scanner BEEP
  playBarcodeBeep(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(2680, now);

    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2680;
    bp.Q.value = 3.5;

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.085, now + 0.004);
    gain.gain.setValueAtTime(0.08, now + 0.068);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.095);

    osc.connect(bp);
    bp.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.105);
  }

  // Classic 1990 mechanical steel cash drawer bell DING! + slide release
  playCashDrawerDing(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Mechanical solenoid release clack
    const clack = ctx.createBufferSource();
    clack.buffer = this.getNoiseBuffer(ctx);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1250;
    const cg = ctx.createGain();
    cg.gain.setValueAtTime(0.11, now);
    cg.gain.exponentialRampToValueAtTime(0.001, now + 0.065);
    clack.connect(bp);
    bp.connect(cg);
    cg.connect(ctx.destination);
    clack.start(now);
    clack.stop(now + 0.075);

    // Shimmering brass register bell partials
    const partials: Array<[number, number, number]> = [
      [2120, 0.08, 0.72],
      [4240, 0.042, 0.44],
      [5680, 0.024, 0.28],
    ];
    partials.forEach(([freq, peak, decay]) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + 0.02);
      g.gain.setValueAtTime(0.0001, now + 0.02);
      g.gain.linearRampToValueAtTime(peak, now + 0.024);
      g.gain.exponentialRampToValueAtTime(0.0005, now + 0.02 + decay);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(now + 0.02);
      osc.stop(now + 0.04 + decay);
    });
  }

  // Solid steel cash drawer slide & latch close
  playDrawerClose(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const src = ctx.createBufferSource();
    src.buffer = this.getNoiseBuffer(ctx);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 820;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.09, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    src.connect(lp);
    lp.connect(g);
    g.connect(ctx.destination);
    src.start(now);
    src.stop(now + 0.15);

    const thud = ctx.createOscillator();
    const tg = ctx.createGain();
    thud.type = 'triangle';
    thud.frequency.setValueAtTime(160, now + 0.08);
    thud.frequency.exponentialRampToValueAtTime(62, now + 0.16);
    tg.gain.setValueAtTime(0.09, now + 0.08);
    tg.gain.exponentialRampToValueAtTime(0.001, now + 0.17);
    thud.connect(tg);
    tg.connect(ctx.destination);
    thud.start(now + 0.08);
    thud.stop(now + 0.18);
  }

  // 1990 Transpac / Carte Bleue authorization FSK chirp
  playModemAuth(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const tones = [1200, 2100, 1200, 2400, 1800, 2400, 1200, 2100];
    tones.forEach((freq, idx) => {
      const t = now + idx * 0.065;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.032, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.055);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.06);
    });
  }

  // Classic 1990 CRT monitor degauss electromagnetic THUMP + subtle buzz decay
  playCrtDegauss(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(112, now);
    osc.frequency.exponentialRampToValueAtTime(48, now + 0.34);
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.14, now + 0.018);
    g.gain.exponentialRampToValueAtTime(0.0008, now + 0.42);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.44);

    // Subtle high-voltage flyback whine transient
    const hv = ctx.createOscillator();
    const hvg = ctx.createGain();
    hv.type = 'sine';
    hv.frequency.setValueAtTime(7800, now + 0.04);
    hv.frequency.exponentialRampToValueAtTime(9400, now + 0.35);
    hvg.gain.setValueAtTime(0.012, now + 0.04);
    hvg.gain.exponentialRampToValueAtTime(0.0005, now + 0.38);
    hv.connect(hvg);
    hvg.connect(ctx.destination);
    hv.start(now + 0.04);
    hv.stop(now + 0.4);
  }

  // Classic 1990 PC BIOS single POST beep
  playPcBiosBeep(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(980, now);
    g.gain.setValueAtTime(0.055, now);
    g.gain.exponentialRampToValueAtTime(0.0008, now + 0.14);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  // 1990 mechanical hard drive seek chatter
  playHddSeek(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const noise = this.getNoiseBuffer(ctx);
    for (let i = 0; i < 4; i++) {
      const t = now + i * 0.055 + Math.random() * 0.018;
      const src = ctx.createBufferSource();
      src.buffer = noise;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1650 + i * 240;
      bp.Q.value = 4.0;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.048, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.028);
      src.connect(bp);
      bp.connect(g);
      g.connect(ctx.destination);
      src.start(t);
      src.stop(t + 0.032);
    }
  }

  // Subtle continuous beige PC tower cooling fan hum
  setPcFanHum(on: boolean): void {
    if (!on) {
      if (this.pcFanSource) {
        try {
          this.pcFanSource.stop();
        } catch {
          // ignore
        }
        this.pcFanSource.disconnect();
        this.pcFanSource = null;
      }
      if (this.pcFanGain) {
        this.pcFanGain.disconnect();
        this.pcFanGain = null;
      }
      return;
    }

    if (this.pcFanSource) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const src = ctx.createBufferSource();
    src.buffer = this.getNoiseBuffer(ctx);
    src.loop = true;

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 260;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.022, ctx.currentTime + 0.8);

    src.connect(lp);
    lp.connect(gain);
    gain.connect(ctx.destination);
    src.start();
    this.pcFanSource = src;
    this.pcFanGain = gain;
  }

  // Crisp 1990 beige ball mouse microswitch left click
  playMouseClick(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.getNoiseBuffer(ctx);
    const hp = ctx.createBiquadFilter();
    hp.type = 'bandpass';
    hp.frequency.value = 3400;
    hp.Q.value = 2.4;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.11, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.022);
    src.connect(hp);
    hp.connect(g);
    g.connect(ctx.destination);
    src.start(now);
    src.stop(now + 0.028);
  }

  // Tactile 1990 Model-M mechanical keyboard CLACK
  playKeyboardClack(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.getNoiseBuffer(ctx);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2400 + (Math.random() - 0.5) * 450;
    bp.Q.value = 2.0;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.095, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.035);
    src.connect(bp);
    bp.connect(g);
    g.connect(ctx.destination);
    src.start(now);
    src.stop(now + 0.04);
  }

  // Realistic high-pitched rubber squeaky dog ball ("pouic-pouic !")
  playSqueakyToy(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const emitSqueak = (offset: number, startF: number, peakF: number, endF: number, dur: number) => {
      const osc = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const bp = ctx.createBiquadFilter();
      const g = ctx.createGain();

      osc.type = 'sawtooth';
      osc2.type = 'triangle';
      osc.frequency.setValueAtTime(startF, now + offset);
      osc.frequency.exponentialRampToValueAtTime(peakF, now + offset + dur * 0.42);
      osc.frequency.exponentialRampToValueAtTime(endF, now + offset + dur);

      osc2.frequency.setValueAtTime(startF * 1.5, now + offset);
      osc2.frequency.exponentialRampToValueAtTime(peakF * 1.48, now + offset + dur * 0.42);
      osc2.frequency.exponentialRampToValueAtTime(endF * 1.45, now + offset + dur);

      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(peakF * 1.05, now + offset);
      bp.Q.value = 3.2;

      g.gain.setValueAtTime(0.0005, now + offset);
      g.gain.linearRampToValueAtTime(0.11, now + offset + 0.018);
      g.gain.exponentialRampToValueAtTime(0.0008, now + offset + dur);

      osc.connect(bp);
      osc2.connect(bp);
      bp.connect(g);
      g.connect(ctx.destination);

      osc.start(now + offset);
      osc2.start(now + offset);
      osc.stop(now + offset + dur + 0.015);
      osc2.stop(now + offset + dur + 0.015);
    };

    // Double squeeze-and-release "POUIC-POUIC !"
    emitSqueak(0, 1450, 2650, 1920, 0.13);
    emitSqueak(0.16, 1720, 2940, 2050, 0.14);
  }

  // Subtle metallic jingle bell chime for cat toy ball
  playCatBellJingle(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const chimeNotes = [3950, 5120, 4480, 6240, 4790];
    chimeNotes.forEach((freq, i) => {
      const t = now + i * 0.042 + Math.random() * 0.012;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.0005, t);
      g.gain.linearRampToValueAtTime(0.04, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0005, t + 0.16);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.18);
    });
  }

  // Soft hollow rubber tennis ball bounce
  playTennisBounce(strength = 1.0): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const vol = Math.max(0.015, Math.min(0.11, 0.09 * strength));
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(240 + strength * 70, now);
    osc.frequency.exponentialRampToValueAtTime(92, now + 0.085);
    g.gain.setValueAtTime(vol, now);
    g.gain.exponentialRampToValueAtTime(0.0008, now + 0.09);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.095);
  }

  // Retractable utility cutter blade slicing through cardboard packing tape
  playCutterSlice(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.getNoiseBuffer(ctx);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(2900, now);
    bp.frequency.exponentialRampToValueAtTime(1150, now + 0.22);
    bp.Q.value = 1.6;

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.12, now + 0.03);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.24);

    src.connect(bp);
    bp.connect(g);
    g.connect(ctx.destination);
    src.start(now);
    src.stop(now + 0.26);
  }

  // Compact 1990 portable electronic label printer buzz + paper tear click
  playLabelPrint(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    for (let i = 0; i < 4; i++) {
      const t = now + i * 0.07;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(760 + (i % 2) * 190, t);
      g.gain.setValueAtTime(0.038, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.052);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.058);
    }
    // Crisp cutter snap at end
    const snap = ctx.createOscillator();
    const sg = ctx.createGain();
    snap.type = 'triangle';
    snap.frequency.setValueAtTime(1400, now + 0.3);
    snap.frequency.exponentialRampToValueAtTime(420, now + 0.34);
    sg.gain.setValueAtTime(0.06, now + 0.3);
    sg.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    snap.connect(sg);
    sg.connect(ctx.destination);
    snap.start(now + 0.3);
    snap.stop(now + 0.36);
  }

  // Sliding paper tag into clear plastic rail or sliding slim display tray into shelf
  playPlasticSlide(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.getNoiseBuffer(ctx);
    const hp = ctx.createBiquadFilter();
    hp.type = 'bandpass';
    hp.frequency.setValueAtTime(2200, now);
    hp.frequency.linearRampToValueAtTime(3100, now + 0.14);
    hp.Q.value = 2.0;

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.07, now + 0.025);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

    src.connect(hp);
    hp.connect(g);
    g.connect(ctx.destination);
    src.start(now);
    src.stop(now + 0.17);
  }

  // Soft weighty thud when setting a kibble bag onto a metal shelf
  playBagThump(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(135, now);
    osc.frequency.exponentialRampToValueAtTime(48, now + 0.13);
    g.gain.setValueAtTime(0.11, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  // Crisp rigid-PVC snap-click when clipping a transparent plastic price rail onto a metal shelf edge
  playPlasticRailSnap(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // 1. Sharp PVC clip snap transient
    const src = ctx.createBufferSource();
    src.buffer = this.getNoiseBuffer(ctx);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(2900, now);
    bp.frequency.exponentialRampToValueAtTime(1650, now + 0.045);
    bp.Q.value = 3.0;

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.14, now + 0.004);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.055);

    src.connect(bp);
    bp.connect(g);
    g.connect(ctx.destination);
    src.start(now);
    src.stop(now + 0.065);

    // 2. Secondary seated click against painted steel lip (+32ms)
    const click = ctx.createOscillator();
    const cg = ctx.createGain();
    click.type = 'triangle';
    click.frequency.setValueAtTime(1420, now + 0.028);
    click.frequency.exponentialRampToValueAtTime(480, now + 0.072);
    cg.gain.setValueAtTime(0.08, now + 0.028);
    cg.gain.exponentialRampToValueAtTime(0.001, now + 0.078);
    click.connect(cg);
    cg.connect(ctx.destination);
    click.start(now + 0.028);
    click.stop(now + 0.085);
  }

  // Light hollow PVC flex/draw sound when taking one plastic rail out of the cardboard box
  playPlasticRailPickup(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const src = ctx.createBufferSource();
    src.buffer = this.getNoiseBuffer(ctx);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(1850, now);
    bp.frequency.linearRampToValueAtTime(2750, now + 0.11);
    bp.Q.value = 2.4;

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.065, now + 0.018);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.13);

    src.connect(bp);
    bp.connect(g);
    g.connect(ctx.destination);
    src.start(now);
    src.stop(now + 0.14);
  }

  // 1990 handheld infrared/serial data transfer chirp ("Terminal Scan -> Étiqueteuse")
  playDataTransferChirp(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = [1480, 1960, 2480, 1960, 2960];
    notes.forEach((freq, idx) => {
      const t = now + idx * 0.042;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, t);
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = freq;
      bp.Q.value = 2.8;
      g.gain.setValueAtTime(0.0005, t);
      g.gain.linearRampToValueAtTime(0.055, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0008, t + 0.036);
      osc.connect(bp);
      bp.connect(g);
      g.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.042);
    });
  }

  // Subtle pleasant confirmation chime when a printed price tag matches the shelf's official catalog price
  playLabelMatchChime(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = [880, 1318.5];
    notes.forEach((freq, idx) => {
      const t = now + idx * 0.095;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.0005, t);
      g.gain.linearRampToValueAtTime(0.06, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0006, t + 0.24);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.26);
    });
  }

  // Authentic 1990 Telxon/MSI acoustic coupler modem data-burst ("TRANSMISSION CENTRALE OK")
  playAcousticModemBurst(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // 1. Carrier handshake tone (2100 Hz)
    const carrier = ctx.createOscillator();
    const cg = ctx.createGain();
    carrier.type = 'sine';
    carrier.frequency.setValueAtTime(2100, now);
    cg.gain.setValueAtTime(0.001, now);
    cg.gain.linearRampToValueAtTime(0.05, now + 0.015);
    cg.gain.setValueAtTime(0.045, now + 0.16);
    cg.gain.exponentialRampToValueAtTime(0.001, now + 0.21);
    carrier.connect(cg);
    cg.connect(ctx.destination);
    carrier.start(now);
    carrier.stop(now + 0.22);

    // 2. Rapid 1200-baud FSK data-burst warble (1200/2200 Hz modulation)
    const fskPattern = [
      1200, 2200, 2200, 1200, 2200, 1200, 1200, 2200, 2200, 1200, 2200, 2200, 1200, 2200,
    ];
    fskPattern.forEach((freq, idx) => {
      const t = now + 0.21 + idx * 0.032;
      const osc = ctx.createOscillator();
      const bp = ctx.createBiquadFilter();
      const g = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, t);
      bp.type = 'bandpass';
      bp.frequency.value = freq;
      bp.Q.value = 2.4;
      g.gain.setValueAtTime(0.045, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.029);
      osc.connect(bp);
      bp.connect(g);
      g.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.031);
    });

    // 3. Centrale acknowledgement double-beep
    const ackStart = now + 0.21 + fskPattern.length * 0.032 + 0.04;
    [1560, 2080].forEach((freq, i) => {
      const t = ackStart + i * 0.085;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.055, t);
      g.gain.exponentialRampToValueAtTime(0.0008, t + 0.07);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.08);
    });
  }

  // Classic 1990 commercial bakery convection oven mechanical "DING!" bell
  playOvenDing(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const partials = [
      { freq: 1865, gain: 0.12, decay: 1.55 },
      { freq: 3742, gain: 0.055, decay: 0.92 },
      { freq: 5490, gain: 0.025, decay: 0.45 },
    ];
    partials.forEach((p) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(p.freq, now);
      g.gain.setValueAtTime(0.0008, now);
      g.gain.linearRampToValueAtTime(p.gain, now + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0004, now + p.decay);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + p.decay + 0.04);
    });
  }

  // Metallic aluminum baking tray sliding onto stainless oven rack rails
  playOvenRackSlide(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const noise = this.getNoiseBuffer(ctx);
    const now = ctx.currentTime;

    const src = ctx.createBufferSource();
    src.buffer = noise;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(2200, now);
    bp.frequency.exponentialRampToValueAtTime(1450, now + 0.24);
    bp.Q.value = 3.2;

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.08, now + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0008, now + 0.26);

    src.connect(bp);
    bp.connect(g);
    g.connect(ctx.destination);
    src.start(now);
    src.stop(now + 0.28);

    // Metallic clink stop at end of slide
    const clink = ctx.createOscillator();
    const cg = ctx.createGain();
    clink.type = 'triangle';
    clink.frequency.setValueAtTime(1180, now + 0.22);
    cg.gain.setValueAtTime(0.045, now + 0.22);
    cg.gain.exponentialRampToValueAtTime(0.0006, now + 0.31);
    clink.connect(cg);
    cg.connect(ctx.destination);
    clink.start(now + 0.22);
    clink.stop(now + 0.33);
  }

  // Commercial 1990 electric bread slicer motor + rhythmic parallel steel blade oscillation ("vrrrr-chac-chac")
  playBreadSlicerRun(durationSec = 2.35): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const noise = this.getNoiseBuffer(ctx);
    const now = ctx.currentTime;

    // 1. Electric AC motor hum (100Hz + 200Hz saw/triangle)
    const motorOsc = ctx.createOscillator();
    const motorFilt = ctx.createBiquadFilter();
    const motorGain = ctx.createGain();
    motorOsc.type = 'sawtooth';
    motorOsc.frequency.setValueAtTime(88, now);
    motorOsc.frequency.linearRampToValueAtTime(118, now + 0.25);
    motorOsc.frequency.setValueAtTime(116, now + durationSec - 0.35);
    motorOsc.frequency.exponentialRampToValueAtTime(55, now + durationSec);

    motorFilt.type = 'lowpass';
    motorFilt.frequency.value = 420;

    motorGain.gain.setValueAtTime(0.001, now);
    motorGain.gain.linearRampToValueAtTime(0.06, now + 0.14);
    motorGain.gain.setValueAtTime(0.055, now + durationSec - 0.3);
    motorGain.gain.exponentialRampToValueAtTime(0.0008, now + durationSec);

    motorOsc.connect(motorFilt);
    motorFilt.connect(motorGain);
    motorGain.connect(ctx.destination);
    motorOsc.start(now);
    motorOsc.stop(now + durationSec + 0.04);

    // 2. Rhythmic parallel blade "chac-chac-chac" crust cutting bursts
    const strokeCount = 12;
    const step = (durationSec - 0.35) / strokeCount;
    for (let i = 0; i < strokeCount; i++) {
      const t = now + 0.18 + i * step;
      const src = ctx.createBufferSource();
      src.buffer = noise;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = i % 2 === 0 ? 1850 : 2450;
      bp.Q.value = 2.6;
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(0.001, t);
      ng.gain.linearRampToValueAtTime(0.072, t + 0.015);
      ng.gain.exponentialRampToValueAtTime(0.001, t + 0.085);
      src.connect(bp);
      bp.connect(ng);
      ng.connect(ctx.destination);
      src.start(t);
      src.stop(t + 0.095);
    }
  }

  // Rhythmic heavy steel butcher knife chopping meat on end-grain oak cutting board
  playButcherKnifeChop(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const noise = this.getNoiseBuffer(ctx);
    const now = ctx.currentTime;

    for (let i = 0; i < 4; i++) {
      const t = now + i * 0.34;
      // Soft meat slice swish
      const swish = ctx.createBufferSource();
      swish.buffer = noise;
      const hp = ctx.createBiquadFilter();
      hp.type = 'bandpass';
      hp.frequency.value = 1800;
      hp.Q.value = 1.6;
      const sg = ctx.createGain();
      sg.gain.setValueAtTime(0.001, t);
      sg.gain.linearRampToValueAtTime(0.04, t + 0.03);
      sg.gain.exponentialRampToValueAtTime(0.0008, t + 0.11);
      swish.connect(hp);
      hp.connect(sg);
      sg.connect(ctx.destination);
      swish.start(t);
      swish.stop(t + 0.12);

      // Solid wooden butcher block thud
      const thud = ctx.createOscillator();
      const tg = ctx.createGain();
      thud.type = 'triangle';
      thud.frequency.setValueAtTime(165 - i * 4, t + 0.06);
      thud.frequency.exponentialRampToValueAtTime(62, t + 0.14);
      tg.gain.setValueAtTime(0.095, t + 0.06);
      tg.gain.exponentialRampToValueAtTime(0.0008, t + 0.16);
      thud.connect(tg);
      tg.connect(ctx.destination);
      thud.start(t + 0.06);
      thud.stop(t + 0.17);
    }
  }

  // Chromed 1990 rotary ham slicer power toggle + circular blade spin-up/down whir
  playHamSlicerToggle(on: boolean): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Mechanical toggle switch clack
    this.playMechanicalButtonClick();

    const osc = ctx.createOscillator();
    const filt = ctx.createBiquadFilter();
    const g = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(on ? 58 : 138, now + 0.04);
    osc.frequency.exponentialRampToValueAtTime(on ? 142 : 42, now + 0.48);
    filt.type = 'lowpass';
    filt.frequency.value = 460;
    g.gain.setValueAtTime(0.001, now + 0.04);
    g.gain.linearRampToValueAtTime(0.055, now + 0.12);
    g.gain.exponentialRampToValueAtTime(0.0008, now + 0.52);
    osc.connect(filt);
    filt.connect(g);
    g.connect(ctx.destination);
    osc.start(now + 0.04);
    osc.stop(now + 0.54);
  }

  // Rotary ham slicer carriage gliding back-and-forth across spinning steel blade ("vrrrr-shhhk")
  playHamSlicerPass(durationSec = 2.05): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const noise = this.getNoiseBuffer(ctx);
    const now = ctx.currentTime;

    const motor = ctx.createOscillator();
    const lp = ctx.createBiquadFilter();
    const mg = ctx.createGain();
    motor.type = 'sawtooth';
    motor.frequency.setValueAtTime(132, now);
    motor.frequency.linearRampToValueAtTime(118, now + durationSec * 0.5);
    motor.frequency.linearRampToValueAtTime(134, now + durationSec);
    lp.type = 'lowpass';
    lp.frequency.value = 520;
    mg.gain.setValueAtTime(0.001, now);
    mg.gain.linearRampToValueAtTime(0.048, now + 0.1);
    mg.gain.setValueAtTime(0.045, now + durationSec - 0.18);
    mg.gain.exponentialRampToValueAtTime(0.0008, now + durationSec);
    motor.connect(lp);
    lp.connect(mg);
    mg.connect(ctx.destination);
    motor.start(now);
    motor.stop(now + durationSec + 0.04);

    // 4 smooth carriage glide & thin slice whisper passes
    for (let i = 0; i < 4; i++) {
      const t = now + 0.12 + i * 0.46;
      const src = ctx.createBufferSource();
      src.buffer = noise;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(2400, t);
      bp.frequency.exponentialRampToValueAtTime(1600, t + 0.28);
      bp.Q.value = 2.8;
      const sg = ctx.createGain();
      sg.gain.setValueAtTime(0.001, t);
      sg.gain.linearRampToValueAtTime(0.052, t + 0.05);
      sg.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      src.connect(bp);
      bp.connect(sg);
      sg.connect(ctx.destination);
      src.start(t);
      src.stop(t + 0.32);
    }
  }

  // Crisp single carriage-lever slicing pass across spinning blade ("zzz-shhhk")
  playHamSlicerStroke(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const noise = this.getNoiseBuffer(ctx);
    const now = ctx.currentTime;

    // Brief blade load dip ("zzz") as ham engages the spinning steel disc
    const osc = ctx.createOscillator();
    const lp = ctx.createBiquadFilter();
    const og = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(148, now);
    osc.frequency.linearRampToValueAtTime(118, now + 0.22);
    osc.frequency.linearRampToValueAtTime(150, now + 0.44);
    lp.type = 'lowpass';
    lp.frequency.value = 620;
    og.gain.setValueAtTime(0.001, now);
    og.gain.linearRampToValueAtTime(0.044, now + 0.05);
    og.gain.setValueAtTime(0.04, now + 0.32);
    og.gain.exponentialRampToValueAtTime(0.0008, now + 0.46);
    osc.connect(lp);
    lp.connect(og);
    og.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.48);

    // Crisp meat slice whisper ("shhhk") during forward blade pass
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(2700, now + 0.06);
    bp.frequency.exponentialRampToValueAtTime(1550, now + 0.34);
    bp.Q.value = 3.0;
    const sg = ctx.createGain();
    sg.gain.setValueAtTime(0.001, now + 0.06);
    sg.gain.linearRampToValueAtTime(0.062, now + 0.11);
    sg.gain.exponentialRampToValueAtTime(0.001, now + 0.36);
    src.connect(bp);
    bp.connect(sg);
    sg.connect(ctx.destination);
    src.start(now + 0.06);
    src.stop(now + 0.38);
  }

  // Tactile butcher paper wrap + adhesive weight-price barcode sticker press
  playStickerPeelApply(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const noise = this.getNoiseBuffer(ctx);
    const now = ctx.currentTime;

    const src = ctx.createBufferSource();
    src.buffer = noise;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(3200, now);
    bp.frequency.exponentialRampToValueAtTime(1400, now + 0.14);
    bp.Q.value = 2.2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.06, now + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0008, now + 0.16);
    src.connect(bp);
    bp.connect(g);
    g.connect(ctx.destination);
    src.start(now);
    src.stop(now + 0.18);
  }

  // Realistic glass bottle clink for Wine, Beer & Spirits unboxing and shelf placement
  playGlassBottleClink(multi = false): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const triggerClink = (offset: number, pitchScale: number, gainPeak: number) => {
      const t = now + offset;
      const partials: Array<[number, number, number]> = [
        [1880 * pitchScale, 0.13, gainPeak],
        [3340 * pitchScale, 0.09, gainPeak * 0.58],
        [5240 * pitchScale, 0.055, gainPeak * 0.3],
      ];
      partials.forEach(([freq, dur, amp]) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t);
        g.gain.setValueAtTime(0.0005, t);
        g.gain.linearRampToValueAtTime(amp, t + 0.004);
        g.gain.exponentialRampToValueAtTime(0.0004, t + dur);
        osc.connect(g);
        g.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + dur + 0.01);
      });
    };

    if (multi) {
      // Multi-bottle rattle when unboxing a wine/beer shipping case with the Cutter
      triggerClink(0.04, 0.96, 0.046);
      triggerClink(0.11, 1.08, 0.038);
      triggerClink(0.17, 1.02, 0.03);
    } else {
      // Subtle crisp bottle-on-wood/glass settling clink
      triggerClink(0.0, 1.0 + (Math.random() - 0.5) * 0.06, 0.044);
      triggerClink(0.022, 1.14, 0.022);
    }
  }

  // Crisp foil chip-bag & cardboard rustle for Sweet Grocery & Snacks unboxing and stocking
  playFoilSnackRustle(unbox = false): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const noise = this.getNoiseBuffer(ctx);
    const now = ctx.currentTime;

    const bursts = unbox ? [0.02, 0.09, 0.17] : [0.0, 0.055];
    bursts.forEach((offset, idx) => {
      const t = now + offset;
      const src = ctx.createBufferSource();
      src.buffer = noise;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(idx % 2 === 0 ? 3600 : 5100, t);
      bp.frequency.exponentialRampToValueAtTime(2200, t + 0.09);
      bp.Q.value = 1.9;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(unbox ? 0.065 : 0.048, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0008, t + 0.11);
      src.connect(bp);
      bp.connect(g);
      g.connect(ctx.destination);
      src.start(t);
      src.stop(t + 0.12);
    });
  }

  // Crisp cardboard + hollow metallic tin-can clink for Savory Grocery unboxing & stocking
  playTinCanClink(unbox = false): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const noise = this.getNoiseBuffer(ctx);
    const now = ctx.currentTime;

    const triggerCan = (offset: number, pitchScale: number, amp: number) => {
      const t = now + offset;
      // Short metallic tin resonance partials
      const partials: Array<[number, number, number]> = [
        [1180 * pitchScale, 0.095, amp],
        [2240 * pitchScale, 0.068, amp * 0.62],
        [3420 * pitchScale, 0.042, amp * 0.3],
      ];
      partials.forEach(([freq, dur, peak]) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t);
        g.gain.setValueAtTime(0.0005, t);
        g.gain.linearRampToValueAtTime(peak, t + 0.003);
        g.gain.exponentialRampToValueAtTime(0.0004, t + dur);
        osc.connect(g);
        g.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + dur + 0.01);
      });
    };

    if (unbox) {
      // Crisp cardboard flap rip + double tin rattle
      const src = ctx.createBufferSource();
      src.buffer = noise;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(2400, now);
      bp.frequency.exponentialRampToValueAtTime(1100, now + 0.14);
      bp.Q.value = 1.6;
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(0.001, now);
      ng.gain.linearRampToValueAtTime(0.065, now + 0.02);
      ng.gain.exponentialRampToValueAtTime(0.0008, now + 0.16);
      src.connect(bp);
      bp.connect(ng);
      ng.connect(ctx.destination);
      src.start(now);
      src.stop(now + 0.18);

      triggerCan(0.05, 0.96, 0.052);
      triggerCan(0.13, 1.07, 0.04);
    } else {
      triggerCan(0.0, 1.0 + (Math.random() - 0.5) * 0.07, 0.048);
      triggerCan(0.025, 1.12, 0.024);
    }
  }

  // Tempered sliding glass lid glide + gentle cold vapor sigh + low compressor hum pulse
  playFreezerGlassSlide(opening: boolean): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const noise = this.getNoiseBuffer(ctx);
    const now = ctx.currentTime;

    // 1. Aluminum track glass slide + cold mist whisper
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(opening ? 1400 : 1850, now);
    bp.frequency.exponentialRampToValueAtTime(opening ? 2500 : 1050, now + 0.24);
    bp.Q.value = 2.4;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.072, now + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0008, now + 0.26);
    src.connect(bp);
    bp.connect(g);
    g.connect(ctx.destination);
    src.start(now);
    src.stop(now + 0.28);

    // 2. Soft rubber end-stop bumper thud
    const stopOsc = ctx.createOscillator();
    const sg = ctx.createGain();
    stopOsc.type = 'triangle';
    stopOsc.frequency.setValueAtTime(opening ? 165 : 135, now + 0.21);
    stopOsc.frequency.exponentialRampToValueAtTime(64, now + 0.28);
    sg.gain.setValueAtTime(0.055, now + 0.21);
    sg.gain.exponentialRampToValueAtTime(0.0008, now + 0.29);
    stopOsc.connect(sg);
    sg.connect(ctx.destination);
    stopOsc.start(now + 0.21);
    stopOsc.stop(now + 0.3);

    // 3. Subtle -18°C freezer compressor hum breath when opened
    if (opening) {
      const hum = ctx.createOscillator();
      const lp = ctx.createBiquadFilter();
      const hg = ctx.createGain();
      hum.type = 'sawtooth';
      hum.frequency.setValueAtTime(50, now);
      lp.type = 'lowpass';
      lp.frequency.value = 160;
      hg.gain.setValueAtTime(0.001, now);
      hg.gain.linearRampToValueAtTime(0.032, now + 0.12);
      hg.gain.exponentialRampToValueAtTime(0.0008, now + 0.65);
      hum.connect(lp);
      lp.connect(hg);
      hg.connect(ctx.destination);
      hum.start(now);
      hum.stop(now + 0.68);
    }
  }

  // Hinged vertical glass freezer door magnetic gasket suction & cold air puff
  playFreezerDoorSeal(opening: boolean): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const noise = this.getNoiseBuffer(ctx);
    const now = ctx.currentTime;

    const thud = ctx.createOscillator();
    const tg = ctx.createGain();
    thud.type = 'sine';
    thud.frequency.setValueAtTime(opening ? 115 : 145, now);
    thud.frequency.exponentialRampToValueAtTime(opening ? 210 : 58, now + 0.11);
    tg.gain.setValueAtTime(0.085, now);
    tg.gain.exponentialRampToValueAtTime(0.0008, now + 0.13);
    thud.connect(tg);
    tg.connect(ctx.destination);
    thud.start(now);
    thud.stop(now + 0.15);

    const puff = ctx.createBufferSource();
    puff.buffer = noise;
    const hp = ctx.createBiquadFilter();
    hp.type = 'bandpass';
    hp.frequency.setValueAtTime(opening ? 2200 : 1400, now + 0.02);
    hp.Q.value = 1.4;
    const pg = ctx.createGain();
    pg.gain.setValueAtTime(0.001, now + 0.02);
    pg.gain.linearRampToValueAtTime(opening ? 0.055 : 0.038, now + 0.06);
    pg.gain.exponentialRampToValueAtTime(0.0008, now + 0.24);
    puff.connect(hp);
    hp.connect(pg);
    pg.connect(ctx.destination);
    puff.start(now + 0.02);
    puff.stop(now + 0.26);
  }

  // Crisp frost-coated frozen carton/bag thump & crackle
  playFrozenPackFrost(unbox = false): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const noise = this.getNoiseBuffer(ctx);
    const now = ctx.currentTime;

    // Crisp icy crackle transient
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const hp = ctx.createBiquadFilter();
    hp.type = 'bandpass';
    hp.frequency.setValueAtTime(4200, now);
    hp.frequency.exponentialRampToValueAtTime(2400, now + (unbox ? 0.18 : 0.09));
    hp.Q.value = 2.2;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.001, now);
    ng.gain.linearRampToValueAtTime(unbox ? 0.072 : 0.048, now + 0.015);
    ng.gain.exponentialRampToValueAtTime(0.0008, now + (unbox ? 0.2 : 0.1));
    src.connect(hp);
    hp.connect(ng);
    ng.connect(ctx.destination);
    src.start(now);
    src.stop(now + (unbox ? 0.22 : 0.11));

    // Solid frozen-block thump
    const th = ctx.createOscillator();
    const tg = ctx.createGain();
    th.type = 'triangle';
    th.frequency.setValueAtTime(175, now + 0.01);
    th.frequency.exponentialRampToValueAtTime(72, now + 0.11);
    tg.gain.setValueAtTime(0.08, now + 0.01);
    tg.gain.exponentialRampToValueAtTime(0.0008, now + 0.12);
    th.connect(tg);
    tg.connect(ctx.destination);
    th.start(now + 0.01);
    th.stop(now + 0.13);
  }

  // Dry poplar wooden crate knock + fresh produce rustle when stocking/picking produce crates
  playWoodenCrateRustle(unbox = false): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const noise = this.getNoiseBuffer(ctx);
    const now = ctx.currentTime;

    // 1. Hollow wooden slat knock
    const wood = ctx.createOscillator();
    const wg = ctx.createGain();
    wood.type = 'triangle';
    wood.frequency.setValueAtTime(unbox ? 280 : 230, now);
    wood.frequency.exponentialRampToValueAtTime(98, now + 0.085);
    wg.gain.setValueAtTime(0.095, now);
    wg.gain.exponentialRampToValueAtTime(0.0008, now + 0.095);
    wood.connect(wg);
    wg.connect(ctx.destination);
    wood.start(now);
    wood.stop(now + 0.105);

    // 2. Soft foliage / burlap / fruit settle rustle
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(1650, now + 0.012);
    bp.frequency.exponentialRampToValueAtTime(980, now + 0.12);
    bp.Q.value = 1.6;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.001, now + 0.012);
    ng.gain.linearRampToValueAtTime(unbox ? 0.055 : 0.038, now + 0.028);
    ng.gain.exponentialRampToValueAtTime(0.0008, now + 0.14);
    src.connect(bp);
    bp.connect(ng);
    ng.connect(ctx.destination);
    src.start(now + 0.012);
    src.stop(now + 0.15);
  }

  // Crisp chilled milk bottle / yogurt tub / wooden camembert box tap on +4°C metal shelf
  playDairyChillPlace(unbox = false): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const noise = this.getNoiseBuffer(ctx);
    const now = ctx.currentTime;

    // 1. Hollow HDPE chilled bottle / dairy pot clack
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(unbox ? 420 : 340, now);
    osc.frequency.exponentialRampToValueAtTime(145, now + 0.075);
    g.gain.setValueAtTime(0.088, now);
    g.gain.exponentialRampToValueAtTime(0.0008, now + 0.085);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.095);

    // 2. Crisp foil/plastic condensation rustle
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(3200, now + 0.008);
    bp.frequency.exponentialRampToValueAtTime(1900, now + 0.095);
    bp.Q.value = 2.0;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.001, now + 0.008);
    ng.gain.linearRampToValueAtTime(unbox ? 0.055 : 0.036, now + 0.02);
    ng.gain.exponentialRampToValueAtTime(0.0008, now + 0.11);
    src.connect(bp);
    bp.connect(ng);
    ng.connect(ctx.destination);
    src.start(now + 0.008);
    src.stop(now + 0.12);
  }

  // Classic 1990 8-bit CRT Demo Kiosk Pong sound effects (square-wave paddle beep, wall boop, score/win jingle)
  playPongTone(kind: 'paddle' | 'wall' | 'score' | 'win' | 'start'): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const triggerNote = (freq: number, offset: number, duration: number, peakGain: number) => {
      const t = now + offset;
      const osc = ctx.createOscillator();
      const lp = ctx.createBiquadFilter();
      const g = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, t);
      lp.type = 'lowpass';
      lp.frequency.value = 3400;
      g.gain.setValueAtTime(0.0008, t);
      g.gain.linearRampToValueAtTime(peakGain, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0006, t + duration);
      osc.connect(lp);
      lp.connect(g);
      g.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + duration + 0.015);
    };

    if (kind === 'paddle') {
      triggerNote(660, 0, 0.055, 0.065);
    } else if (kind === 'wall') {
      triggerNote(330, 0, 0.048, 0.055);
    } else if (kind === 'start') {
      triggerNote(523.25, 0, 0.07, 0.06);
      triggerNote(659.25, 0.075, 0.07, 0.06);
      triggerNote(783.99, 0.15, 0.12, 0.065);
    } else if (kind === 'score') {
      triggerNote(440, 0, 0.08, 0.06);
      triggerNote(880, 0.085, 0.14, 0.065);
    } else if (kind === 'win') {
      triggerNote(523.25, 0, 0.08, 0.065);
      triggerNote(659.25, 0.085, 0.08, 0.065);
      triggerNote(783.99, 0.17, 0.08, 0.065);
      triggerNote(1046.5, 0.255, 0.22, 0.075);
    }
  }

  // Crisp 1990 cardboard game cartridge box / hardcover comic & manga placement tap
  playGameBoxClack(unbox = false): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const noise = this.getNoiseBuffer(ctx);
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(unbox ? 360 : 295, now);
    osc.frequency.exponentialRampToValueAtTime(125, now + 0.068);
    g.gain.setValueAtTime(0.085, now);
    g.gain.exponentialRampToValueAtTime(0.0008, now + 0.078);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.088);

    const src = ctx.createBufferSource();
    src.buffer = noise;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(2500, now + 0.006);
    bp.frequency.exponentialRampToValueAtTime(1400, now + 0.085);
    bp.Q.value = 1.9;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.001, now + 0.006);
    ng.gain.linearRampToValueAtTime(unbox ? 0.052 : 0.034, now + 0.018);
    ng.gain.exponentialRampToValueAtTime(0.0008, now + 0.095);
    src.connect(bp);
    bp.connect(ng);
    ng.connect(ctx.destination);
    src.start(now + 0.006);
    src.stop(now + 0.105);
  }

  // Crisp hollow aluminum 33cl soda can clink on chilled metal shelf
  playSodaCanClink(unbox = false): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const partials = unbox
      ? [
          { freq: 1180, gain: 0.065, decay: 0.08 },
          { freq: 1860, gain: 0.048, decay: 0.11 },
          { freq: 2740, gain: 0.032, decay: 0.09 },
        ]
      : [
          { freq: 1040, gain: 0.062, decay: 0.085 },
          { freq: 1720, gain: 0.042, decay: 0.095 },
        ];

    partials.forEach((p, idx) => {
      const t = now + idx * 0.009;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(p.freq, t);
      osc.frequency.exponentialRampToValueAtTime(p.freq * 0.86, t + p.decay);
      g.gain.setValueAtTime(0.0008, t);
      g.gain.linearRampToValueAtTime(p.gain, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0006, t + p.decay);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + p.decay + 0.015);
    });
  }

  // Authentic 1990 commercial espresso machine: brief bean grind + 9-bar vibration pump + steam hiss
  playEspressoBrew(durationSec = 3.2): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const noise = this.getNoiseBuffer(ctx);
    const now = ctx.currentTime;

    // 1. Short burrs grinder whirr (0.0s -> 0.55s)
    const grind = ctx.createOscillator();
    const grindFilt = ctx.createBiquadFilter();
    const grindGain = ctx.createGain();
    grind.type = 'sawtooth';
    grind.frequency.setValueAtTime(165, now);
    grind.frequency.linearRampToValueAtTime(220, now + 0.45);
    grindFilt.type = 'bandpass';
    grindFilt.frequency.value = 620;
    grindFilt.Q.value = 1.6;
    grindGain.gain.setValueAtTime(0.001, now);
    grindGain.gain.linearRampToValueAtTime(0.055, now + 0.06);
    grindGain.gain.setValueAtTime(0.048, now + 0.45);
    grindGain.gain.exponentialRampToValueAtTime(0.0008, now + 0.58);
    grind.connect(grindFilt);
    grindFilt.connect(grindGain);
    grindGain.connect(ctx.destination);
    grind.start(now);
    grind.stop(now + 0.6);

    // 2. 9-Bar espresso vibration pump hum (0.55s -> durationSec - 0.15s)
    const pumpStart = now + 0.52;
    const pumpDur = Math.max(1.0, durationSec - 0.68);
    const pump = ctx.createOscillator();
    const pumpLp = ctx.createBiquadFilter();
    const pumpGain = ctx.createGain();
    pump.type = 'sawtooth';
    pump.frequency.setValueAtTime(100, pumpStart);
    pump.frequency.linearRampToValueAtTime(96, pumpStart + pumpDur);
    pumpLp.type = 'lowpass';
    pumpLp.frequency.value = 340;
    pumpGain.gain.setValueAtTime(0.001, pumpStart);
    pumpGain.gain.linearRampToValueAtTime(0.048, pumpStart + 0.12);
    pumpGain.gain.setValueAtTime(0.044, pumpStart + pumpDur - 0.18);
    pumpGain.gain.exponentialRampToValueAtTime(0.0008, pumpStart + pumpDur);
    pump.connect(pumpLp);
    pumpLp.connect(pumpGain);
    pumpGain.connect(ctx.destination);
    pump.start(pumpStart);
    pump.stop(pumpStart + pumpDur + 0.04);

    // 3. Pressurized steam & hot coffee extraction hiss (looped noise burst)
    const steam = ctx.createBufferSource();
    steam.buffer = noise;
    steam.loop = true;
    const steamBp = ctx.createBiquadFilter();
    steamBp.type = 'bandpass';
    steamBp.frequency.setValueAtTime(3400, pumpStart);
    steamBp.frequency.linearRampToValueAtTime(2200, pumpStart + pumpDur);
    steamBp.Q.value = 1.2;
    const steamGain = ctx.createGain();
    steamGain.gain.setValueAtTime(0.001, pumpStart);
    steamGain.gain.linearRampToValueAtTime(0.052, pumpStart + 0.25);
    steamGain.gain.setValueAtTime(0.042, pumpStart + pumpDur - 0.25);
    steamGain.gain.exponentialRampToValueAtTime(0.0008, pumpStart + pumpDur + 0.12);
    steam.connect(steamBp);
    steamBp.connect(steamGain);
    steamGain.connect(ctx.destination);
    steam.start(pumpStart);
    steam.stop(pumpStart + pumpDur + 0.15);
  }

  // Roasted coffee beans tumbling into transparent espresso hopper
  playCoffeeBeansPour(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const noise = this.getNoiseBuffer(ctx);
    const now = ctx.currentTime;
    for (let i = 0; i < 14; i++) {
      const t = now + i * 0.048 + Math.random() * 0.015;
      const src = ctx.createBufferSource();
      src.buffer = noise;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1750 + Math.random() * 1450;
      bp.Q.value = 3.6;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.055, t);
      g.gain.exponentialRampToValueAtTime(0.0008, t + 0.036);
      src.connect(bp);
      bp.connect(g);
      g.connect(ctx.destination);
      src.start(t);
      src.stop(t + 0.042);
    }
  }

  // 1990 commercial microwave transformer hum (100Hz/200Hz) during 30s heating cycle
  playMicrowaveRun(durationSec = 3.2): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    this.playMechanicalButtonClick();

    const hum1 = ctx.createOscillator();
    const hum2 = ctx.createOscillator();
    const lp = ctx.createBiquadFilter();
    const g = ctx.createGain();
    hum1.type = 'sawtooth';
    hum2.type = 'sine';
    hum1.frequency.setValueAtTime(100, now + 0.04);
    hum2.frequency.setValueAtTime(200, now + 0.04);
    lp.type = 'lowpass';
    lp.frequency.value = 280;
    g.gain.setValueAtTime(0.001, now + 0.04);
    g.gain.linearRampToValueAtTime(0.045, now + 0.16);
    g.gain.setValueAtTime(0.042, now + durationSec - 0.14);
    g.gain.exponentialRampToValueAtTime(0.0008, now + durationSec);
    hum1.connect(lp);
    hum2.connect(lp);
    lp.connect(g);
    g.connect(ctx.destination);
    hum1.start(now + 0.04);
    hum2.start(now + 0.04);
    hum1.stop(now + durationSec + 0.04);
    hum2.stop(now + durationSec + 0.04);
  }

  // Classic crisp 1990 microwave mechanical bell "DING!"
  playMicrowaveDing(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const partials = [
      { freq: 2420, gain: 0.11, decay: 1.35 },
      { freq: 4845, gain: 0.05, decay: 0.72 },
      { freq: 7210, gain: 0.022, decay: 0.36 },
    ];
    partials.forEach((p) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(p.freq, now);
      g.gain.setValueAtTime(0.0008, now);
      g.gain.linearRampToValueAtTime(p.gain, now + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0004, now + p.decay);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + p.decay + 0.04);
    });
  }

  // Warm parchment paper rustle + light glass shelf tap when stocking hot snacks
  playHotSnackPlace(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const noise = this.getNoiseBuffer(ctx);
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(2400, now);
    bp.frequency.exponentialRampToValueAtTime(1400, now + 0.11);
    bp.Q.value = 1.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.06, now + 0.018);
    g.gain.exponentialRampToValueAtTime(0.0008, now + 0.13);
    src.connect(bp);
    bp.connect(g);
    g.connect(ctx.destination);
    src.start(now);
    src.stop(now + 0.14);
  }

  // 1990 Office PC "CENTRALE-ACHAT 90" dial-up 2400-baud modem handshake + dot-matrix order slip confirmation
  playCentraleAchatModemAndPrinter(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // 1. Classic 1990 dial-up modem carrier + FSK burst (0.00s..0.52s)
    const carrier = ctx.createOscillator();
    const cg = ctx.createGain();
    carrier.type = 'sine';
    carrier.frequency.setValueAtTime(1950, now);
    carrier.frequency.setValueAtTime(2100, now + 0.08);
    cg.gain.setValueAtTime(0.001, now);
    cg.gain.linearRampToValueAtTime(0.048, now + 0.015);
    cg.gain.setValueAtTime(0.042, now + 0.14);
    cg.gain.exponentialRampToValueAtTime(0.0008, now + 0.18);
    carrier.connect(cg);
    cg.connect(ctx.destination);
    carrier.start(now);
    carrier.stop(now + 0.19);

    const fsk = [1200, 2400, 1650, 2400, 1200, 2100, 2400, 1350, 2400, 1800];
    fsk.forEach((freq, idx) => {
      const t = now + 0.18 + idx * 0.03;
      const osc = ctx.createOscillator();
      const bp = ctx.createBiquadFilter();
      const g = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, t);
      bp.type = 'bandpass';
      bp.frequency.value = freq;
      bp.Q.value = 2.6;
      g.gain.setValueAtTime(0.038, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.026);
      osc.connect(bp);
      bp.connect(g);
      g.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.029);
    });

    // 2. Brief 1990 dot-matrix order slip confirmation sweeps (0.50s..0.82s)
    for (let i = 0; i < 4; i++) {
      const t = now + 0.5 + i * 0.072;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(680 + (i % 2) * 210, t);
      g.gain.setValueAtTime(0.034, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.052);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.058);
    }

    // 3. Final confirmation chime
    const ack = ctx.createOscillator();
    const ag = ctx.createGain();
    ack.type = 'sine';
    ack.frequency.setValueAtTime(1760, now + 0.8);
    ag.gain.setValueAtTime(0.05, now + 0.8);
    ag.gain.exponentialRampToValueAtTime(0.0008, now + 0.94);
    ack.connect(ag);
    ag.connect(ctx.destination);
    ack.start(now + 0.8);
    ack.stop(now + 0.96);
  }

  // Authentic 1990 16-tonne hydraulic cardboard baler pump hum, cardboard crush & pressure relief hiss
  playHydraulicBalerCrush(hasBoxes = true): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const noise = this.getNoiseBuffer(ctx);

    // 1. Heavy hydraulic lever latch clack (0.0s)
    this.playMechanicalButtonClick();

    // 2. Electric-hydraulic pump motor ramp + sustained press whine (0.08s..1.45s)
    const pump = ctx.createOscillator();
    const pumpSub = ctx.createOscillator();
    const pumpFilt = ctx.createBiquadFilter();
    const pumpGain = ctx.createGain();
    pump.type = 'sawtooth';
    pumpSub.type = 'triangle';
    pump.frequency.setValueAtTime(72, now + 0.08);
    pump.frequency.linearRampToValueAtTime(118, now + 0.38);
    pump.frequency.linearRampToValueAtTime(92, now + 1.05);
    pump.frequency.linearRampToValueAtTime(126, now + 1.38);
    pump.frequency.exponentialRampToValueAtTime(58, now + 1.68);
    pumpSub.frequency.setValueAtTime(48, now + 0.08);
    pumpSub.frequency.linearRampToValueAtTime(58, now + 1.25);

    pumpFilt.type = 'lowpass';
    pumpFilt.frequency.setValueAtTime(480, now + 0.08);
    pumpFilt.frequency.linearRampToValueAtTime(680, now + 0.95);
    pumpFilt.frequency.exponentialRampToValueAtTime(240, now + 1.68);

    pumpGain.gain.setValueAtTime(0.001, now + 0.08);
    pumpGain.gain.linearRampToValueAtTime(0.085, now + 0.24);
    pumpGain.gain.setValueAtTime(0.075, now + 1.35);
    pumpGain.gain.exponentialRampToValueAtTime(0.001, now + 1.72);

    pump.connect(pumpFilt);
    pumpSub.connect(pumpFilt);
    pumpFilt.connect(pumpGain);
    pumpGain.connect(ctx.destination);
    pump.start(now + 0.08);
    pumpSub.start(now + 0.08);
    pump.stop(now + 1.76);
    pumpSub.stop(now + 1.76);

    // 3. Corrugated cardboard crunching & folding bursts during platen compression (0.42s..1.18s)
    if (hasBoxes) {
      const crunchTimes = [0.42, 0.58, 0.74, 0.92, 1.08];
      crunchTimes.forEach((offset, idx) => {
        const t = now + offset;
        const src = ctx.createBufferSource();
        src.buffer = noise;
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.setValueAtTime(1150 + idx * 140, t);
        bp.frequency.exponentialRampToValueAtTime(520, t + 0.14);
        bp.Q.value = 1.3;
        const cg = ctx.createGain();
        cg.gain.setValueAtTime(0.001, t);
        cg.gain.linearRampToValueAtTime(0.11, t + 0.02);
        cg.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
        src.connect(bp);
        bp.connect(cg);
        cg.connect(ctx.destination);
        src.start(t);
        src.stop(t + 0.18);
      });
    }

    // 4. Hydraulic valve pressure relief hiss at return stroke (1.32s..1.72s)
    const hiss = ctx.createBufferSource();
    hiss.buffer = noise;
    const hp = ctx.createBiquadFilter();
    hp.type = 'bandpass';
    hp.frequency.setValueAtTime(2800, now + 1.32);
    hp.frequency.exponentialRampToValueAtTime(1400, now + 1.72);
    hp.Q.value = 1.8;
    const hg = ctx.createGain();
    hg.gain.setValueAtTime(0.001, now + 1.32);
    hg.gain.linearRampToValueAtTime(0.055, now + 1.4);
    hg.gain.exponentialRampToValueAtTime(0.0008, now + 1.76);
    hiss.connect(hp);
    hp.connect(hg);
    hg.connect(ctx.destination);
    hiss.start(now + 1.32);
    hiss.stop(now + 1.8);
  }

  // Subtle 1990 automatic sliding entrance door radar relay click + smooth pneumatic/belt track glide
  playAutomaticDoorSlide(opening: boolean): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const noise = this.getNoiseBuffer(ctx);

    // 1. Crisp overhead radar relay micro-click (0.0s)
    const relayOsc = ctx.createOscillator();
    const relayGain = ctx.createGain();
    relayOsc.type = 'triangle';
    relayOsc.frequency.setValueAtTime(opening ? 1850 : 1420, now);
    relayOsc.frequency.exponentialRampToValueAtTime(opening ? 920 : 740, now + 0.024);
    relayGain.gain.setValueAtTime(0.001, now);
    relayGain.gain.linearRampToValueAtTime(0.048, now + 0.003);
    relayGain.gain.exponentialRampToValueAtTime(0.0006, now + 0.028);
    relayOsc.connect(relayGain);
    relayGain.connect(ctx.destination);
    relayOsc.start(now);
    relayOsc.stop(now + 0.032);

    // 2. Smooth pneumatic / aluminum-rail glass door glide (0.03s .. 0.62s)
    const glide = ctx.createBufferSource();
    glide.buffer = noise;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(opening ? 520 : 780, now + 0.03);
    bp.frequency.exponentialRampToValueAtTime(opening ? 940 : 420, now + 0.56);
    bp.Q.value = 1.9;

    const gg = ctx.createGain();
    gg.gain.setValueAtTime(0.0008, now + 0.03);
    gg.gain.linearRampToValueAtTime(0.042, now + 0.14);
    gg.gain.setValueAtTime(0.036, now + 0.42);
    gg.gain.exponentialRampToValueAtTime(0.0006, now + 0.62);

    glide.connect(bp);
    bp.connect(gg);
    gg.connect(ctx.destination);
    glide.start(now + 0.03);
    glide.stop(now + 0.65);

    // 3. Soft rubber buffer stop when fully closed
    if (!opening) {
      const stopThump = ctx.createOscillator();
      const sg = ctx.createGain();
      stopThump.type = 'sine';
      stopThump.frequency.setValueAtTime(118, now + 0.52);
      stopThump.frequency.exponentialRampToValueAtTime(52, now + 0.62);
      sg.gain.setValueAtTime(0.045, now + 0.52);
      sg.gain.exponentialRampToValueAtTime(0.0008, now + 0.64);
      stopThump.connect(sg);
      sg.connect(ctx.destination);
      stopThump.start(now + 0.52);
      stopThump.stop(now + 0.66);
    }
  }

  // Realistic 1990 steel filing cabinet ball-bearing rail slide + latch click + stop clunk
  playMetalDrawerSlide(opening: boolean): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const noise = this.getNoiseBuffer(ctx);

    // 1. Crisp metallic latch release/engage click (0.0s)
    const latch = ctx.createOscillator();
    const lg = ctx.createGain();
    latch.type = 'triangle';
    latch.frequency.setValueAtTime(opening ? 1620 : 1240, now);
    latch.frequency.exponentialRampToValueAtTime(opening ? 760 : 540, now + 0.025);
    lg.gain.setValueAtTime(0.055, now);
    lg.gain.exponentialRampToValueAtTime(0.0008, now + 0.03);
    latch.connect(lg);
    lg.connect(ctx.destination);
    latch.start(now);
    latch.stop(now + 0.034);

    // 2. Band-passed steel ball-bearing rail glide friction (0.02s .. 0.34s)
    const rail = ctx.createBufferSource();
    rail.buffer = noise;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(opening ? 1150 : 1650, now + 0.02);
    bp.frequency.exponentialRampToValueAtTime(opening ? 1950 : 920, now + 0.3);
    bp.Q.value = 3.2;

    const rg = ctx.createGain();
    rg.gain.setValueAtTime(0.001, now + 0.02);
    rg.gain.linearRampToValueAtTime(0.055, now + 0.07);
    rg.gain.setValueAtTime(0.044, now + 0.22);
    rg.gain.exponentialRampToValueAtTime(0.0008, now + 0.34);

    rail.connect(bp);
    bp.connect(rg);
    rg.connect(ctx.destination);
    rail.start(now + 0.02);
    rail.stop(now + 0.36);

    // 3. Resonant hollow sheet-metal end stop clunk
    const clunk = ctx.createOscillator();
    const cg = ctx.createGain();
    clunk.type = 'sine';
    const stopT = now + (opening ? 0.27 : 0.29);
    clunk.frequency.setValueAtTime(opening ? 210 : 168, stopT);
    clunk.frequency.exponentialRampToValueAtTime(opening ? 88 : 62, stopT + 0.075);
    cg.gain.setValueAtTime(opening ? 0.05 : 0.085, stopT);
    cg.gain.exponentialRampToValueAtTime(0.0008, stopT + 0.09);
    clunk.connect(cg);
    cg.connect(ctx.destination);
    clunk.start(stopT);
    clunk.stop(stopT + 0.095);
  }

  dispose(): void {
    this.setPcFanHum(false);
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
    this.noiseBuffer = null;
  }
}

export const soundSynth = new SoundSynthesizer();
