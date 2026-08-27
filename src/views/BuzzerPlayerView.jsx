import React, { useState, useEffect, useCallback, useRef } from "react";
import { Zap, Maximize2, Minimize2, Lock } from "lucide-react";
import { getColor } from "../constants.js";
import { getMatchTeams } from "../utils/helpers.js";
import { broadcastBuzzer } from "../lib/sync-engine.js";

export function BuzzerPlayerView({ roomId, match, syncStatus, onConnectRoom, sounds, theme, lockedOutTeams = [] }) {
  const containerRef = useRef(null);
  const teams = getMatchTeams(match);
  const [selectedTeamId, setSelectedTeamId] = useState(() => {
    return localStorage.getItem("participant_team_id") || "A";
  });
  const [flashBg, setFlashBg] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const isLockedOut = Array.isArray(lockedOutTeams) && lockedOutTeams.includes(selectedTeamId);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      if (containerRef.current && containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen().catch(() => { });
      } else if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => { });
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => { });
      }
    }
  };

  const handleSelectTeam = (id) => {
    setSelectedTeamId(id);
    localStorage.setItem("participant_team_id", id);
  };

  const handleBuzzPress = useCallback(() => {
    if (!roomId || isLockedOut) return;
    if (sounds && sounds.buzzTeam) {
      sounds.buzzTeam(teams.findIndex((t) => t.id === selectedTeamId) || 0);
    }
    setFlashBg(true);
    setTimeout(() => setFlashBg(false), 400);

    broadcastBuzzer(roomId, selectedTeamId);
  }, [roomId, selectedTeamId, teams, sounds, isLockedOut]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (["INPUT", "TEXTAREA", "SELECT"].includes(e.target?.tagName)) return;
      if (e.repeat) return;
      if (e.code === "Space" || e.code === "Enter" || e.key === " " || e.key === "Enter") {
        e.preventDefault();
        handleBuzzPress();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleBuzzPress]);

  const currentTeamObj = teams.find((t) => t.id === selectedTeamId) || teams[0] || { id: "A", name: "Tim A", color: "blue" };
  const colorInfo = getColor(currentTeamObj.color || "blue");
  const isLight = theme === "light";

  return (
    <div ref={containerRef} className={`min-h-screen flex flex-col justify-between p-4 md:p-8 transition-colors ${flashBg ? "bg-amber-400" : isLight ? "bg-slate-100 text-[#2C3592]" : "bg-slate-950 text-white"}`}>
      {/* Top Header */}
      <div className="flex items-center justify-between gap-4 max-w-2xl mx-auto w-full flex-wrap">
        <div>
          <h1 className="text-lg md:text-xl font-black tracking-tight">Bel Peserta Olimpiade</h1>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={toggleFullscreen}
            className={`px-3 py-1.5 rounded-xl text-xs font-black border shadow-sm flex items-center gap-1.5 transition-all ${isLight ? "bg-white text-slate-800 border-slate-300 hover:bg-slate-100" : "bg-slate-900 text-amber-400 border-slate-700 hover:bg-slate-800"}`}
            title="Layar Penuh / Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5 text-amber-500" /> : <Maximize2 className="w-3.5 h-3.5 text-amber-500" />}
            <span>{isFullscreen ? "Keluar Fullscreen" : "Layar Penuh"}</span>
          </button>

          <div className="flex items-center gap-2 bg-white dark:bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-800 shadow-sm text-xs font-extrabold">
            <span className={`w-2.5 h-2.5 rounded-full ${syncStatus === "connected" ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`} />
            <span>Room: <strong className="font-mono text-sm">{roomId || "OFFLINE"}</strong></span>
          </div>
        </div>
      </div>

      {/* Main Center Area */}
      <div className="max-w-xl mx-auto w-full flex flex-col items-center justify-center my-6 space-y-6">
        <div className="w-full">
          <label className="block text-center text-xs font-black uppercase tracking-wider opacity-70 mb-2">PILIH TIM PESERTA ANDA:</label>
          <div className="flex flex-wrap justify-center gap-2">
            {teams.map((t) => {
              const selected = selectedTeamId === t.id;
              const tColor = getColor(t.color);
              const locked = Array.isArray(lockedOutTeams) && lockedOutTeams.includes(t.id);
              return (
                <button
                  key={t.id}
                  onClick={() => handleSelectTeam(t.id)}
                  className={`px-4 py-2 rounded-xl text-xs font-black transition-all border shadow-sm flex items-center gap-1 ${selected ? `${tColor.badge} scale-105 ring-2 ring-amber-400 shadow-md` : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700 opacity-70 hover:opacity-100"}`}
                >
                  {locked && <Lock className="w-3 h-3 text-red-500 shrink-0" />}
                  <span>TIM {t.id} ({t.name})</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className={`w-full p-4 rounded-2xl border-2 text-center shadow-md bg-gradient-to-br ${isLight ? colorInfo.bgLight : colorInfo.bgDark} ${isLight ? colorInfo.borderLight : colorInfo.borderDark}`}>
          <div className="flex items-center justify-center gap-2">
            <span className={`${colorInfo.badge} text-xs px-3 py-1 rounded-full uppercase tracking-wider shadow-sm`}>ANDA ADALAH TIM {currentTeamObj.id}</span>
            {isLockedOut && <span className="bg-red-600 text-white text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider animate-pulse">🔒 TERKUNCI SOAL INI</span>}
          </div>
          <div className="text-xl md:text-2xl font-black mt-1">{currentTeamObj.name}</div>
          <div className="text-xs opacity-75 font-medium">{currentTeamObj.school || "-"}</div>
        </div>

        {/* Giant Tactile 3D Bel Button */}
        <div className="w-full flex flex-col items-center justify-center py-4">
          {isLockedOut ? (
            <div className="relative w-64 h-64 md:w-72 md:h-72 rounded-full bg-slate-700/80 p-4 border-4 border-slate-600 flex flex-col items-center justify-center select-none shadow-inner text-center">
              <div className="w-full h-full rounded-full bg-slate-800/90 flex flex-col items-center justify-center p-6 border-4 border-slate-700 text-slate-400 text-center">
                <Lock className="w-16 h-16 md:w-20 md:h-20 mb-2 text-red-500 animate-pulse" />
                <span className="text-2xl md:text-3xl font-black tracking-wider uppercase text-red-400">BEL TERKUNCI</span>
                <span className="text-[11px] font-semibold mt-2 opacity-90 bg-red-950/60 text-red-200 px-3 py-1.5 rounded-xl border border-red-800/40">
                  Sudah Menjawab Salah di Soal Ini
                </span>
              </div>
            </div>
          ) : (
            <button
              onClick={handleBuzzPress}
              className="group relative w-64 h-64 md:w-72 md:h-72 rounded-full bg-gradient-to-b from-red-500 via-red-600 to-red-800 p-4 shadow-[0_20px_50px_rgba(220,38,38,0.5)] border-4 border-red-400 active:scale-95 active:shadow-inner transition-all flex flex-col items-center justify-center cursor-pointer select-none"
            >
              <div className="w-full h-full rounded-full bg-gradient-to-b from-rose-400 via-red-500 to-red-700 flex flex-col items-center justify-center p-6 border-4 border-rose-300/40 shadow-inner text-white text-center">
                <Zap className="w-16 h-16 md:w-20 md:h-20 mb-2 drop-shadow-md group-hover:scale-110 transition-transform animate-bounce" />
                <span className="text-3xl md:text-4xl font-black tracking-wider uppercase drop-shadow-md">TEKAN BEL!</span>
                <span className="text-[11px] font-mono mt-1 opacity-90 font-bold bg-black/20 px-3 py-1 rounded-full border border-white/20">TEKAN SPASI / ENTER</span>
              </div>
            </button>
          )}
        </div>

        <div className="text-center opacity-70 text-xs font-medium max-w-xs">
          {isLockedOut ? (
            <span className="text-red-500 dark:text-red-400 font-bold">⚠️ Bel Anda terkunci untuk nomor soal ini. Tunggu soal dilempar ke tim lain atau lanjut ke nomor soal berikutnya.</span>
          ) : (
            <>💡 Tips: Anda dapat menekan layar bel ini, mengeklik mouse, atau menekan tombol <strong>SPACEBAR / ENTER</strong> di keyboard PC/Laptop Anda.</>
          )}
        </div>
      </div>
    </div>
  );
}
