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
      const teamTones = [
        [880, 1174.66],
        [783.99, 1046.50],
        [987.77, 1318.51],
        [659.25, 880.00],
        [1046.50, 1396.91],
        [830.61, 1108.73],
        [932.33, 1244.51],
        [739.99, 987.77],
      ];
      const chord = teamTones[idx % teamTones.length];
      chord.forEach((freq) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(freq, ctx.currentTime);

        gain.gain.setValueAtTime(0.35, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.45);
      });
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
