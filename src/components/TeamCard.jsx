import React from "react";
import { Zap } from "lucide-react";
import { getColor } from "../constants.js";

export function TeamCard({ team, active, gettingAnswer, isLockedOut, isDimmed, theme, onSelect, compact }) {
  const colorInfo = getColor(team.color || "blue");
  const isLight = theme === "light";

  const bgGradient = isLight ? colorInfo.bgLight : colorInfo.bgDark;
  const borderColor = gettingAnswer ? "border-amber-400" : isLight ? colorInfo.borderLight : colorInfo.borderDark;
  const textColor = isLight ? colorInfo.textLight : colorInfo.textDark;

  return (
    <div
      onClick={onSelect}
      className={`relative bg-gradient-to-br ${bgGradient} border-2 ${borderColor} rounded-2xl p-5 md:p-6 flex flex-col items-center text-center transition-all shadow-sm ${
        gettingAnswer
          ? "ring-8 ring-amber-400 scale-[1.04] shadow-[0_0_50px_rgba(255,230,0,0.85)] z-30 animate-pulse"
          : active
          ? `ring-4 ${colorInfo.ring} buzz-active-glow scale-[1.02]`
          : "hover:border-[#2C3592]"
      } ${onSelect ? "cursor-pointer" : ""} ${isLockedOut ? "opacity-60" : ""} ${isDimmed ? "opacity-40 scale-95 grayscale-[30%]" : ""}`}
    >
      <div className="flex items-center gap-1.5 mb-3 flex-wrap justify-center">
        <span className={`${colorInfo.badge} text-xs font-black px-3.5 py-1 rounded-full tracking-widest uppercase shadow-sm`}>
          TIM {team.id}
        </span>
        {isLockedOut && (
          <span className="bg-red-600 text-white text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow-sm">
            ❌ TERKUNCI
          </span>
        )}
      </div>
      <div className="text-lg md:text-2xl font-extrabold truncate w-full tracking-tight mb-1">{team.name || `Tim ${team.id}`}</div>
      <div className="text-xs md:text-sm opacity-75 mb-4 truncate w-full font-medium">{team.school || "-"}</div>
      <div className={`font-mono-num font-black tabular-nums ${compact ? "text-3xl md:text-4xl" : "text-5xl md:text-6xl"} ${textColor}`}>
        {team.score || 0}
      </div>
      {gettingAnswer && (
        <div className="mt-4 text-xs md:text-sm font-black bg-[#FFE600] text-[#2C3592] border-2 border-amber-300 px-4 py-2 rounded-xl animate-bounce shadow-xl tracking-wider flex items-center gap-1.5">
          <Zap className="w-4 h-4 text-red-600 shrink-0" />
          <span>🔔 MENEKAN BEL!</span>
        </div>
      )}
    </div>
  );
}

