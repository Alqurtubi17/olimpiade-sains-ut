import { useRef, useEffect, useCallback, useMemo } from "react";

export function useSoundEngine(soundOn) {
  const ctxRef = useRef(null);
  const soundOnRef = useRef(soundOn);
  useEffect(() => { soundOnRef.current = soundOn; }, [soundOn]);

  const ensureCtx = useCallback(() => {
    if (!ctxRef.current) {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        ctxRef.current = new AC();
      } catch (e) { return null; }
    }
    if (ctxRef.current.state === "suspended") {
      ctxRef.current.resume().catch(() => { });
    }
    return ctxRef.current;
  }, []);

  const tone = useCallback((freq = 440, dur = 150, type = "sine", vol = 0.18) => {
    if (!soundOnRef.current) return;
    const ctx = ensureCtx();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(vol, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur / 1000);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + dur / 1000);
    } catch (e) { }
  }, [ensureCtx]);

  const timerStart = useCallback(() => tone(880, 150, "sine", 0.25), [tone]);
  const tenLeft = useCallback(() => tone(1046.5, 140, "square", 0.22), [tone]);

  const timeUp = useCallback(() => {
    if (!soundOnRef.current) return;
    const ctx = ensureCtx();
    if (!ctx) return;
    try {
      const freqs = [440, 554.37, 659.25, 880];
      freqs.forEach((freq) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(freq, ctx.currentTime);

        gain.gain.setValueAtTime(0.32, ctx.currentTime);
        gain.gain.setValueAtTime(0.32, ctx.currentTime + 1.1);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.4);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 1.4);
      });
    } catch (e) { }
  }, [ensureCtx]);

  const buzzTeam = useCallback((idx = 0) => {
    if (!soundOnRef.current) return;
    const ctx = ensureCtx();
    if (!ctx) return;
    try {
      let teamIndex = 0;
      if (typeof idx === "number") {
        teamIndex = Math.max(0, idx);
      } else if (typeof idx === "string") {
        const clean = idx.trim().toUpperCase().replace(/^TIM\s*/, "");
        const charCode = clean.charCodeAt(0);
        if (charCode >= 65 && charCode <= 90) {
          teamIndex = charCode - 65;
        } else {
          const parsed = parseInt(clean, 10);
          teamIndex = isNaN(parsed) ? 0 : Math.max(0, parsed - 1);
        }
      }

      const now = ctx.currentTime;

      // Dynamics Compressor for loud, crisp & distortion-free audio output
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.setValueAtTime(-10, now);
      comp.knee.setValueAtTime(30, now);
      comp.ratio.setValueAtTime(10, now);
      comp.attack.setValueAtTime(0.003, now);
      comp.release.setValueAtTime(0.2, now);
      comp.connect(ctx.destination);

      const playChord = (notes, waveType = "sawtooth", duration = 0.5, vol = 0.55, glide = null) => {
        notes.forEach(({ f, delay = 0, dur = duration }) => {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = waveType;
          const startTime = now + delay;
          const stopTime = startTime + dur;

          if (glide) {
            osc.frequency.setValueAtTime(f, startTime);
            osc.frequency.exponentialRampToValueAtTime(glide, stopTime);
          } else {
            osc.frequency.setValueAtTime(f, startTime);
          }

          g.gain.setValueAtTime(0.001, startTime);
          g.gain.linearRampToValueAtTime(vol, startTime + 0.015);
          g.gain.exponentialRampToValueAtTime(0.001, stopTime);

          osc.connect(g);
          g.connect(comp);
          osc.start(startTime);
          osc.stop(stopTime);
        });
      };

      const profiles = [
        // Tim A (Blue): High Bright Fanfare Ding-Dong (D5 -> A5 + C#6 + F#6)
        () => playChord([
          { f: 587.33, delay: 0, dur: 0.15 },
          { f: 880.00, delay: 0.08, dur: 0.45 },
          { f: 1108.73, delay: 0.08, dur: 0.45 },
          { f: 1479.98, delay: 0.08, dur: 0.45 },
        ], "sawtooth", 0.55, 0.55),

        // Tim B (Red): Loud Punchy TV Horn Chord (Low A3 + E4 + A4 + C#5)
        () => playChord([
          { f: 220.00, delay: 0, dur: 0.5 },
          { f: 329.63, delay: 0, dur: 0.5 },
          { f: 440.00, delay: 0, dur: 0.5 },
          { f: 554.37, delay: 0, dur: 0.5 },
        ], "square", 0.5, 0.60),

        // Tim C (Green): Sparkling Major Arpeggio Chime (C5 -> E5 -> G5 -> C6)
        () => playChord([
          { f: 523.25, delay: 0, dur: 0.45 },
          { f: 659.25, delay: 0.05, dur: 0.45 },
          { f: 783.99, delay: 0.10, dur: 0.45 },
          { f: 1046.50, delay: 0.15, dur: 0.50 },
        ], "triangle", 0.55, 0.65),

        // Tim D (Yellow): Snappy Double Staccato Cyber Beep (E6 & G#6)
        () => playChord([
          { f: 1318.51, delay: 0, dur: 0.12 },
          { f: 1661.22, delay: 0, dur: 0.12 },
          { f: 1318.51, delay: 0.14, dur: 0.35 },
          { f: 1661.22, delay: 0.14, dur: 0.35 },
        ], "square", 0.45, 0.50),

        // Tim E (Purple): High-Tech Sweep Glissando (Rise 450Hz -> 1350Hz + E5/B5 chord)
        () => playChord([
          { f: 450.00, delay: 0, dur: 0.45 },
          { f: 659.25, delay: 0.05, dur: 0.45 },
          { f: 987.77, delay: 0.05, dur: 0.45 },
        ], "sine", 0.45, 0.70, 1350.00),

        // Tim F (Orange): Loud Brass Fanfare (F4 + A4 + C5 + F5)
        () => playChord([
          { f: 349.23, delay: 0, dur: 0.48 },
          { f: 440.00, delay: 0, dur: 0.48 },
          { f: 523.25, delay: 0, dur: 0.48 },
          { f: 698.46, delay: 0.48 },
        ], "sawtooth", 0.48, 0.60),

        // Tim G (Teal): High Ringing Metallic Chime (G5 + D6 + B6)
        () => playChord([
          { f: 783.99, delay: 0, dur: 0.55 },
          { f: 1174.66, delay: 0, dur: 0.55 },
          { f: 1975.53, delay: 0, dur: 0.55 },
        ], "sine", 0.55, 0.65),

        // Tim H (Pink): Retro Arcade Triple Octave Jump (G4 -> G5 -> G6)
        () => playChord([
          { f: 392.00, delay: 0, dur: 0.12 },
          { f: 784.00, delay: 0.08, dur: 0.14 },
          { f: 1567.98, delay: 0.16, dur: 0.40 },
        ], "square", 0.50, 0.50),
      ];

      const playFn = profiles[teamIndex % profiles.length];
      playFn();
    } catch (e) { }
  }, [ensureCtx]);

  const correct = useCallback(() => {
    tone(1046.5, 150, "sine", 0.25);
    setTimeout(() => tone(1567.98, 250, "sine", 0.25), 140);
  }, [tone]);

  const wrong = useCallback(() => {
    tone(220, 200, "sawtooth", 0.3);
    setTimeout(() => tone(165, 300, "sawtooth", 0.3), 180);
  }, [tone]);

  return useMemo(() => ({
    timerStart, tenLeft, timeUp, buzzTeam, correct, wrong
  }), [timerStart, tenLeft, timeUp, buzzTeam, correct, wrong]);
}
