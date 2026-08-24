import React from "react";

export function TimerBar({ seconds = 45, duration = 45, running = false, size = "lg", theme = "light" }) {
  const pct = Math.max(0, Math.min(100, (seconds / (duration || 45)) * 100));
  const danger = seconds <= 10;
  const warn = seconds <= 20 && seconds > 10;

  const barColor = danger ? "bg-red-600" : warn ? "bg-amber-500" : "bg-[#2C3592] dark:bg-emerald-400";
  const sizeCls = size === "xl" ? "text-8xl md:text-9xl" : "text-6xl md:text-7xl";

  const colorHex = danger
    ? "#DC2626"
    : warn
      ? "#D97706"
      : theme === "light"
        ? "#2C3592"
        : "#FFFFFF";

  return (
    <div className="flex flex-col items-center w-full">
      <div
        className={`font-mono-num font-black tabular-nums leading-none ${sizeCls} ${danger && running ? "animate-pulse" : ""}`}
        style={{ color: colorHex }}
      >
        {String(seconds).padStart(2, "0")}
      </div>
      <div className="w-full max-w-xs h-4 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden mt-4 border border-slate-300 dark:border-slate-600">
        <div className={`h-full ${barColor} transition-all duration-200 ease-linear`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
