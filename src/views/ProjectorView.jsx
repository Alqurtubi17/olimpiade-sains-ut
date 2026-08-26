import React, { useState } from "react";
import { Tv, ArrowLeft } from "lucide-react";
import { Btn, LogoUT } from "../components/UI.jsx";
import { TimerBar } from "../components/TimerBar.jsx";
import { TeamCard } from "../components/TeamCard.jsx";
import { getMatchTeams, getWajibQnum } from "../utils/helpers.js";

export function ProjectorView({ match, timerDisplay, timerDuration, timerRunning, statusMessage, onExit, theme }) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const isLight = theme === "light";

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => { });
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => { });
        setIsFullscreen(false);
      }
    }
  };

  if (!match) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center p-6 text-center ${isLight ? "bg-gradient-to-br from-indigo-50 via-slate-50 to-blue-50 text-slate-900" : "bg-slate-900 text-white"}`}>
        <LogoUT className="h-20 w-auto mb-4 bg-white p-2.5 rounded-2xl shadow-md border border-slate-200" />
        <h2 className="text-2xl font-black mb-2">Tidak Ada Pertandingan Aktif</h2>
        <p className="opacity-75 text-sm max-w-md mb-6 font-medium">Silakan buat pertandingan baru atau buka dari Daftar Pertandingan.</p>
        <Btn tone="amber" icon={ArrowLeft} onClick={onExit}>Kembali</Btn>
      </div>
    );
  }

  const teams = getMatchTeams(match);
  const isWajib = match.round_type === "wajib";
  const isCadangan = match.round_type === "cadangan";
  const roundLabel = isWajib
    ? "SOAL WAJIB"
    : isCadangan
    ? "SOAL CADANGAN (PENENTUAN PEMENANG)"
    : "SOAL REBUTAN";

  const activeWajibTeam = statusMessage || teams[0]?.id || "A";
  const qNum = isWajib
    ? getWajibQnum(match, activeWajibTeam)
    : isCadangan
    ? match.cadangan_qnum || 1
    : match.rebutan_qnum || 1;

  const qMaxDisplay = isWajib ? (match.wajib_max_qnum || 5) : isCadangan ? "BEBAS" : (match.rebutan_max_qnum || 10);

  let gridCols = "grid-cols-2";
  if (teams.length === 3) gridCols = "grid-cols-1 md:grid-cols-3";
  else if (teams.length === 4) gridCols = "grid-cols-2 md:grid-cols-4";
  else if (teams.length >= 5) gridCols = "grid-cols-2 md:grid-cols-3 lg:grid-cols-4";

  return (
    <div className={`min-h-screen w-full flex flex-col p-6 md:p-10 justify-between relative overflow-hidden transition-colors ${isLight ? "bg-gradient-to-br from-indigo-50/90 via-slate-50 to-blue-50/90 text-slate-900" : "bg-slate-900 text-white"}`}>
      {/* Full-Height Background Watermark Logo */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden opacity-10 z-0 p-4">
        <LogoUT className="h-[82vh] w-auto max-w-[85vw] object-contain filter drop-shadow-2xl" />
      </div>

      {/* Top Floating Controls */}
      <div className="absolute top-4 right-4 z-50 flex items-center gap-2 opacity-60 hover:opacity-100 transition-opacity">
        <button
          onClick={toggleFullscreen}
          className={`px-3.5 py-2 rounded-xl text-xs font-black shadow-lg flex items-center gap-1.5 transition-all border ${isLight ? "bg-white text-slate-800 border-slate-300 hover:bg-slate-100" : "bg-slate-800/80 text-white border-slate-700 hover:bg-slate-700"}`}
        >
          <Tv className="w-4 h-4 text-amber-500" />
          <span>{isFullscreen ? "Keluar Fullscreen" : "Mode Fullscreen Proyektor"}</span>
        </button>
        <button
          onClick={onExit}
          className="bg-red-600 hover:bg-red-500 text-white px-3.5 py-2 rounded-xl text-xs font-black shadow-lg flex items-center gap-1.5 transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Kembali</span>
        </button>
      </div>

      {/* Header Banner */}
      <div className="text-center pt-2 mb-6 z-10 flex flex-col items-center">
        <h1 className={`font-black text-3xl md:text-5xl lg:text-6xl tracking-wider uppercase drop-shadow-md ${isLight ? "text-[#2C3592]" : "text-[#FFE600]"}`}>
          {match?.match_name || "FINAL OLIMPIADE SAINS"}
        </h1>
        <div className={`font-black text-base md:text-2xl lg:text-3xl tracking-[0.25em] uppercase mt-1 ${isLight ? "text-amber-600" : "text-white/90"}`}>
          UNIVERSITAS TERBUKA
        </div>
      </div>

      {/* Timer & Question Stage */}
      <div className="flex flex-col items-center justify-center mb-8 gap-2 z-10">
        <div className={`font-extrabold tracking-widest text-xl md:text-3xl ${isLight ? "text-[#2C3592]" : "text-amber-400"}`}>{roundLabel}</div>
        <div className="font-bold text-base md:text-xl opacity-80 mb-2">
          {isCadangan ? `PERTANYAAN CADANGAN KE-${qNum}` : (typeof qMaxDisplay === "number" && qNum > qMaxDisplay) ? `BABAK SELESAI (${qMaxDisplay}/${qMaxDisplay} SOAL)` : `PERTANYAAN KE-${qNum} DARI ${qMaxDisplay}`}
        </div>
        <TimerBar seconds={timerDisplay} duration={timerDuration} running={timerRunning} size="xl" theme={theme} />
      </div>

      {/* Team Cards Stage */}
      <div className={`grid ${gridCols} gap-6 flex-1 items-stretch max-w-7xl mx-auto w-full`}>
        {teams.map((t) => (
          <TeamCard
            key={t.id}
            team={t}
            theme={theme}
            gettingAnswer={statusMessage === t.id}
          />
        ))}
      </div>
    </div>
  );
}
