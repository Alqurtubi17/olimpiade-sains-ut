import React from "react";
import { getColor } from "../constants.js";

export function TeamCard({ team, active, gettingAnswer, theme, onSelect, compact }) {
  const colorInfo = getColor(team.color || "blue");
  const isLight = theme === "light";

  const bgGradient = isLight ? colorInfo.bgLight : colorInfo.bgDark;
  const borderColor = isLight ? colorInfo.borderLight : colorInfo.borderDark;
  const textColor = isLight ? colorInfo.textLight : colorInfo.textDark;

  return (
    <div
      onClick={onSelect}
      className={`relative bg-gradient-to-br ${bgGradient} border-2 ${borderColor} rounded-2xl p-5 md:p-6 flex flex-col items-center text-center transition-all shadow-sm hover:shadow-md ${active ? `ring-4 ${colorInfo.ring} buzz-active-glow scale-[1.02]` : "hover:border-[#2C3592]"} ${onSelect ? "cursor-pointer" : ""}`}
    >
      <span className={`${colorInfo.badge} text-xs font-black px-3.5 py-1 rounded-full tracking-widest mb-3 uppercase shadow-sm`}>
        TIM {team.id}
      </span>
      <div className="text-lg md:text-2xl font-extrabold truncate w-full tracking-tight mb-1">{team.name || `Tim ${team.id}`}</div>
      <div className="text-xs md:text-sm opacity-75 mb-4 truncate w-full font-medium">{team.school || "-"}</div>
      <div className={`font-mono-num font-black tabular-nums ${compact ? "text-3xl md:text-4xl" : "text-5xl md:text-6xl"} ${textColor}`}>
        {team.score || 0}
      </div>
      {gettingAnswer && (
        <div className="mt-4 text-xs md:text-sm font-black bg-[#FFE600] text-[#2C3592] px-3.5 py-1.5 rounded-xl animate-pulse shadow-md tracking-wider">
          KESEMPATAN MENJAWAB
        </div>
      )}
    </div>
  );
}
