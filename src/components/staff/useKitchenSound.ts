"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const PREF_KEY = "gg-kds-sound";

function readPref(): boolean {
  try {
    return localStorage.getItem(PREF_KEY) === "on";
  } catch {
    return false;
  }
}
function writePref(on: boolean) {
  try {
    localStorage.setItem(PREF_KEY, on ? "on" : "off");
  } catch {
    /* private mode: the toggle still works for this visit */
  }
}

/** Two-tone "ding-dong" synthesised with WebAudio, so no audio file ships. */
function chime(ctx: AudioContext) {
  const t0 = ctx.currentTime + 0.02;
  const tone = (freq: number, start: number, dur: number) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.45, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + dur + 0.05);
  };
  tone(1046.5, t0, 0.45); // C6
  tone(784, t0 + 0.22, 0.7); // G5
}

/**
 * Kitchen alert sound. Browsers only allow audio after a user gesture, so sound starts off until someone presses
 * "Enable sound"; the preference persists, and after a reload the first tap anywhere re-unlocks the audio.
 */
export function useKitchenSound() {
  const ctxRef = useRef<AudioContext | null>(null);
  const [wanted, setWanted] = useState(readPref);
  const [unlocked, setUnlocked] = useState(false);

  const unlock = useCallback(async () => {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return false;
    ctxRef.current ??= new AC();
    try {
      await ctxRef.current.resume();
    } catch {
      return false;
    }
    const ok = ctxRef.current.state === "running";
    setUnlocked(ok);
    return ok;
  }, []);

  // Preference already on (from an earlier visit): unlock on the first gesture anywhere on the page.
  useEffect(() => {
    if (!wanted || unlocked) return;
    const once = () => void unlock();
    window.addEventListener("pointerdown", once, { once: true });
    window.addEventListener("keydown", once, { once: true });
    return () => {
      window.removeEventListener("pointerdown", once);
      window.removeEventListener("keydown", once);
    };
  }, [wanted, unlocked, unlock]);

  const enable = useCallback(async () => {
    setWanted(true);
    writePref(true);
    if (await unlock()) chime(ctxRef.current!);
  }, [unlock]);

  const disable = useCallback(() => {
    setWanted(false);
    writePref(false);
  }, []);

  const play = useCallback(() => {
    const ctx = ctxRef.current;
    if (wanted && ctx && ctx.state === "running") chime(ctx);
  }, [wanted]);

  useEffect(() => () => void ctxRef.current?.close(), []);

  return { on: wanted && unlocked, wanted, enable, disable, play };
}
