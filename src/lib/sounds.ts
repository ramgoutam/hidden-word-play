// Sound effect utilities using Web Audio API

class SoundEffects {
  private audioContext: AudioContext | null = null;

  private getAudioContext() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return this.audioContext;
  }

  private playTone(frequency: number, duration: number, type: OscillatorType = 'sine', volume: number = 0.3) {
    const ctx = this.getAudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.frequency.value = frequency;
    oscillator.type = type;
    
    gainNode.gain.setValueAtTime(volume, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + duration);
  }

  drumRoll() {
    const ctx = this.getAudioContext();
    const duration = 1.5;
    
    // Create drum roll effect with multiple hits
    for (let i = 0; i < 15; i++) {
      setTimeout(() => {
        this.playTone(80 + Math.random() * 20, 0.05, 'triangle', 0.2);
      }, i * (duration * 1000) / 15);
    }
  }

  reveal() {
    // Ascending tone for reveal
    const frequencies = [400, 500, 600, 800];
    frequencies.forEach((freq, index) => {
      setTimeout(() => {
        this.playTone(freq, 0.15, 'sine', 0.25);
      }, index * 100);
    });
  }

  victory() {
    // Victory fanfare
    const melody = [
      { freq: 523, duration: 0.2 }, // C
      { freq: 659, duration: 0.2 }, // E
      { freq: 784, duration: 0.2 }, // G
      { freq: 1047, duration: 0.4 }, // C (high)
    ];
    
    melody.forEach((note, index) => {
      setTimeout(() => {
        this.playTone(note.freq, note.duration, 'sine', 0.3);
      }, index * 200);
    });
  }

  defeat() {
    // Descending tones for defeat
    const melody = [
      { freq: 400, duration: 0.3 },
      { freq: 350, duration: 0.3 },
      { freq: 300, duration: 0.5 },
    ];
    
    melody.forEach((note, index) => {
      setTimeout(() => {
        this.playTone(note.freq, note.duration, 'sine', 0.3);
      }, index * 300);
    });
  }

  suspense() {
    // Low suspenseful tone
    this.playTone(110, 0.8, 'triangle', 0.2);
    setTimeout(() => {
      this.playTone(130, 0.8, 'triangle', 0.2);
    }, 800);
  }
}

export const sounds = new SoundEffects();
