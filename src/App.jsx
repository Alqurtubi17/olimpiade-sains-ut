import React, { useState, useEffect, useRef, useCallback } from "react";
import * as XLSX from "xlsx";
import {
  Play, Pause, RotateCcw, Volume2, VolumeX, Trophy, CheckCircle2, XCircle,
  Clock, Bell, Download, ListChecks, Monitor, FileText, AlertTriangle,
  Edit3, ChevronRight, Users, ArrowLeft, Undo2, Flag, PlusCircle, ShieldAlert,
  BookOpen, Settings2, Zap, Sun, Moon, Share2, Wifi, WifiOff, Copy, Check,
  Layers, Tv, Sparkles, Plus, Trash2, Radio, Home, Swords
} from "lucide-react";
import {
  generateRoomId, initSyncEngine, broadcastState, broadcastBuzzer, disconnectSyncEngine, broadcastGlobalMatchesIndex
} from "./lib/sync-engine.js";
import { setActiveSyncRoom } from "./lib/storage-shim.js";

/* ============================== URL ROUTING SYSTEM ============================== */

const navSubscribers = new Set();

function navigateTo(pathname, params = {}) {
  const url = new URL(window.location.origin + pathname);
  Object.entries(params).forEach(([k, v]) => {
    if (v) url.searchParams.set(k, v);
  });
  window.history.pushState({}, "", url.toString());
  const parsed = parseLocation();
  navSubscribers.forEach((fn) => fn(parsed));
  window.dispatchEvent(new Event("popstate"));
}

function parseLocation() {
  const path = window.location.pathname.toLowerCase();
  const searchParams = new URLSearchParams(window.location.search);
  const roomParam = searchParams.get("room") || searchParams.get("id");
  const matchParam = searchParams.get("match");
  const viewParam = searchParams.get("view");

  if (path === "/setup" || path.endsWith("/setup")) return { view: "setup", roomParam, matchParam };
  if (path === "/rules" || path.endsWith("/rules")) return { view: "rules", roomParam, matchParam };
  if (path === "/projector" || path.endsWith("/projector")) return { view: "projector", roomParam, matchParam };
  if (path === "/recap" || path.endsWith("/recap")) return { view: "recap", roomParam, matchParam };
  if (path === "/buzzer" || path.endsWith("/buzzer") || viewParam === "buzzer") return { view: "buzzer", roomParam, matchParam };
  if (path === "/room" || path.endsWith("/room") || (roomParam && path !== "/matches")) return { view: "dashboard", roomParam, matchParam };
  return { view: "matches", roomParam, matchParam };
}

/* ============================== LOGO UNIVERSITAS TERBUKA ============================== */

function UtLogo({ className = "h-12 w-auto" }) {
  return (
    <img
      src="/logo-ut.png?v=2"
      alt="Logo Universitas Terbuka"
      className={`object-contain shrink-0 ${className}`}
    />
  );
}

import { TEAM_COLORS, getColor } from "./constants.js";

/* ============================== HELPERS ============================== */

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const nowIso = () => new Date().toISOString();
const pad2 = (n) => String(n).padStart(2, "0");

function fmtClock(sec) {
  const s = Math.max(0, Math.floor(sec));
  return `${pad2(Math.floor(s / 60))}:${pad2(s % 60)}`;
}

function fmtDateTime(iso) {
  if (!iso) return "-";
  try {
    const d = new Date(iso);
    return d.toLocaleString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch (e) { return iso; }
}

function slug(s) {
  return (s || "Tim").trim().replace(/[^a-zA-Z0-9]+/g, "");
}

export function getMatchTeams(match) {
  if (!match) return [];
  if (Array.isArray(match.teams) && match.teams.length > 0) {
    return match.teams;
  }
  return [
    { id: "A", name: "Tim A", school: "UT Bandung", score: 0, color: "blue" },
    { id: "B", name: "Tim B", school: "UT Jakarta", score: 0, color: "red" },
  ];
}

export function getWajibQnum(match, teamId) {
  if (!match) return 1;
  const tId = teamId || "A";
  if (match.wajib_qnums && match.wajib_qnums[tId] !== undefined) {
    return match.wajib_qnums[tId];
  }
  const key = `wajib_${tId.toLowerCase()}_qnum`;
  return match[key] || 1;
}

export function incrementWajibQnum(match, teamId) {
  if (!match) return match;
  const tId = teamId || "A";
  const current = getWajibQnum(match, tId);
  const nextQ = current + 1;
  const key = `wajib_${tId.toLowerCase()}_qnum`;
  const wajib_qnums = { ...(match.wajib_qnums || {}), [tId]: nextQ };
  return {
    ...match,
    [key]: nextQ,
    wajib_qnums,
  };
}

export function teamNameById(match, teamId) {
  const teams = getMatchTeams(match);
  const found = teams.find((t) => t.id === teamId);
  return found ? found.name : `Tim ${teamId}`;
}

function resultLabel(result) {
  switch (result) {
    case "benar": return "Benar";
    case "salah": return "Salah";
    case "waktu_habis": return "Waktu Habis";
    case "tidak_menjawab": return "Tidak Menjawab";
    default: return "-";
  }
}

function winnersLabel(match) {
  if (!match) return "-";
  const teams = getMatchTeams(match);
  if (teams.length === 0) return "-";

  if (match.winner) {
    if (match.winner === "SERI") return "SERI";
    const found = teams.find((t) => t.id === match.winner);
    if (found) return found.name;
  }

  const maxScore = Math.max(...teams.map((t) => t.score));
  const topTeams = teams.filter((t) => t.score === maxScore);
  if (topTeams.length > 1) return `SERI (${topTeams.map((t) => t.name).join(" & ")})`;
  return topTeams[0] ? topTeams[0].name : "-";
}

function computeStats(match, questionEvents, buzzerEvents) {
  const teams = getMatchTeams(match);
  const wajib = questionEvents.filter((e) => e.round_type === "wajib");
  const rebutan = questionEvents.filter((e) => e.round_type === "rebutan");

  const teamStats = {};
  teams.forEach((t) => {
    const wajibPts = wajib.filter((e) => e.answering_team === t.id).reduce((a, e) => a + (e.points || 0), 0);
    const rebPts = rebutan.filter((e) => e.answering_team === t.id).reduce((a, e) => a + (e.points || 0), 0);
    const wajibBenar = wajib.filter((e) => e.answering_team === t.id && e.result === "benar").length;
    const wajibTotal = wajib.filter((e) => e.answering_team === t.id && e.result).length;
    const rebBenar = rebutan.filter((e) => e.answering_team === t.id && e.result === "benar").length;
    const rebTotal = rebutan.filter((e) => e.answering_team === t.id && e.result).length;
    const totalBenar = wajibBenar + rebBenar;
    const totalAttempt = wajibTotal + rebTotal;
    const pct = totalAttempt > 0 ? Math.round((totalBenar / totalAttempt) * 100) : 0;

    teamStats[t.id] = {
      name: t.name,
      school: t.school,
      color: t.color,
      totalScore: t.score,
      wajibPts,
      rebPts,
      wajibBenar,
      wajibTotal,
      rebBenar,
      rebTotal,
      totalBenar,
      totalAttempt,
      pct,
    };
  });

  const benar = questionEvents.filter((e) => e.result === "benar").length;
  const salah = questionEvents.filter((e) => e.result === "salah" || e.result === "waktu_habis").length;
  const penalti = rebutan.filter((e) => e.points < 0).length;
  const belKosong = buzzerEvents.filter((e) => e.response_status === "tidak_menjawab").length;
  const jumlahRebutan = buzzerEvents.length;

  return {
    totalWajib: wajib.length,
    totalRebutan: rebutan.length,
    benar, salah, penalti, belKosong,
    jumlahRebutan,
    teamStats,
  };
}

/* ============================== SOUND ENGINE ============================== */

function useSoundEngine(soundOn) {
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
      // Loud high-pitched TV quiz show alarm buzzer "TETTTTTTTTT!" (1.4s duration)
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
      // Loud high-pitched piercing TV quiz show team buzzer ("TEEEET!")
      const teamTones = [
        [880, 1174.66],   // Tim A: High A5 + D6
        [783.99, 1046.50], // Tim B: High G5 + C6
        [987.77, 1318.51], // Tim C: High B5 + E6
        [659.25, 880.00],  // Tim D: High E5 + A5
        [1046.50, 1396.91],// Tim E: High C6 + F6
        [830.61, 1108.73], // Tim F: High G#5 + C#6
        [932.33, 1244.51], // Tim G: High A#5 + D#6
        [739.99, 987.77],  // Tim H: High F#5 + B5
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

  return React.useMemo(() => ({
    timerStart, tenLeft, timeUp, buzzTeam, correct, wrong
  }), [timerStart, tenLeft, timeUp, buzzTeam, correct, wrong]);
}

/* ============================== UI PRIMITIVES ============================== */

function Btn({ children, onClick, disabled, tone = "slate", size = "md", className = "", icon: Icon }) {
  const tones = {
    slate: "bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300 shadow-sm dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-100 dark:border-slate-700 font-bold",
    blue: "bg-[#2C3592] hover:bg-[#1E256C] text-white border-[#1E256C] shadow-sm font-black",
    red: "bg-red-600 hover:bg-red-500 text-white border-red-500 shadow-sm font-black disabled:bg-rose-200 disabled:text-rose-500 dark:disabled:bg-rose-950/40 dark:disabled:text-rose-600 disabled:border-transparent",
    emerald: "bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500 shadow-sm font-black",
    amber: "bg-[#FFE600] hover:bg-amber-300 text-[#2C3592] border-amber-300 font-black shadow-md",
    purple: "bg-purple-600 hover:bg-purple-500 text-white border-purple-500 shadow-sm font-black",
    outline: "bg-white hover:bg-slate-100 text-slate-800 border-slate-300 shadow-sm font-bold dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-100 dark:border-slate-700",
    ghost: "bg-transparent hover:bg-slate-200/50 dark:hover:bg-slate-800/30 text-slate-700 dark:text-slate-300 border-transparent",
  };
  const sizes = {
    sm: "px-3.5 py-1.5 text-xs rounded-lg",
    md: "px-4 py-2.5 text-sm rounded-xl",
    lg: "px-6 py-3.5 text-base rounded-xl",
    xl: "px-8 py-4.5 text-lg rounded-2xl",
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 border tracking-wide transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 ${tones[tone]} ${sizes[size]} ${className}`}
    >
      {Icon ? <Icon className="w-4 h-4 shrink-0" /> : null}
      {children}
    </button>
  );
}

function Panel({ children, className = "" }) {
  return <div className={`glass-panel rounded-2xl shadow-lg ${className}`}>{children}</div>;
}

function Modal({ title, children, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
      <div className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-3xl w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-2xl border border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-lg font-black tracking-tight">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-2xl leading-none px-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">×</button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children, className = "block mb-3" }) {
  return (
    <label className={className}>
      <span className="block text-xs font-extrabold uppercase tracking-wider opacity-80 mb-1">{label}</span>
      {children}
    </label>
  );
}

const inputCls = "w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#2C3592] dark:focus:ring-[#FFE600] focus:bg-white dark:focus:bg-slate-800 shadow-sm transition-all text-sm font-medium";

/* ============================== TIMER BLOCK ============================== */

function TimerBlock({ seconds, duration, running, size = "lg", theme }) {
  const pct = duration > 0 ? Math.max(0, Math.min(100, (seconds / duration) * 100)) : 0;
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

/* ============================== TEAM CARD ============================== */

function TeamCard({ team, active, gettingAnswer, theme, onSelect, compact }) {
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

/* ============================== HISTORY TABLE ============================== */

function HistoryTable({ scoreLog = [], match, compact }) {
  const logsToUse = (scoreLog && scoreLog.length > 0) ? scoreLog : (match?.score_log || []);
  const cleanLogs = logsToUse.filter((item, index, self) =>
    index === self.findIndex((t) => (
      t.timestamp === item.timestamp &&
      t.team === item.team &&
      t.points_change === item.points_change &&
      t.event === item.event
    ))
  );
  const rows = [...cleanLogs].reverse();
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs md:text-sm">
        <thead>
          <tr className="text-left text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700/60 uppercase tracking-wider text-[10px] md:text-xs font-extrabold">
            <th className="py-3 pr-3">No</th>
            <th className="py-3 pr-3">Waktu</th>
            <th className="py-3 pr-3">Tim</th>
            <th className="py-3 pr-3">Keterangan</th>
            <th className="py-3 pr-3 text-right">Perubahan Poin</th>
            <th className="py-3 pr-3 text-right">Total Poin</th>
            {!compact && <th className="py-3 pr-3">Operator</th>}
            {!compact && <th className="py-3 pr-3">Catatan</th>}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr><td colSpan={8} className="py-8 text-center opacity-50 font-medium">Belum ada riwayat poin.</td></tr>
          )}
          {rows.map((r, i) => {
            const teamName = teamNameById(match, r.team);
            return (
              <tr key={r.id || i} className="border-b border-slate-100 dark:border-slate-800/40 hover:bg-slate-100/60 dark:hover:bg-slate-800/30">
                <td className="py-3 pr-3 opacity-50 font-medium">{rows.length - i}</td>
                <td className="py-3 pr-3 opacity-75 font-medium">{fmtDateTime(r.timestamp)}</td>
                <td className="py-3 pr-3 font-extrabold">{teamName}</td>
                <td className="py-3 pr-3 font-medium">{r.event}</td>
                <td className={`py-3 pr-3 text-right font-mono-num font-black ${r.points_change > 0 ? "text-emerald-700 dark:text-emerald-400" : r.points_change < 0 ? "text-red-700 dark:text-red-400" : "opacity-60"}`}>
                  {r.points_change > 0 ? "+" : ""}{r.points_change}
                </td>
                <td className="py-3 pr-3 text-right font-mono-num font-bold">{r.score_after ?? r.score_after_a ?? "-"}</td>
                {!compact && <td className="py-3 pr-3 opacity-70">{r.operator || "-"}</td>}
                {!compact && <td className="py-3 pr-3 opacity-50">{r.correction_reason || ""}</td>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ============================== EXCEL EXPORT ============================== */

function fileNameFor(m) {
  const teams = getMatchTeams(m);
  const teamNamesSlug = teams.map((t) => slug(t.name)).join("_vs_");
  return `Hasil_Olimpiade_2026_Pertandingan_${pad2(m.match_number)}_${teamNamesSlug}.xlsx`;
}

function boldRow(ws, rowIndex, ncols) {
  for (let c = 0; c < ncols; c++) {
    const addr = XLSX.utils.encode_cell({ r: rowIndex, c });
    if (ws[addr]) ws[addr].s = { font: { bold: true } };
  }
}

function buildMatchWorkbook(m, questionEvents, scoreLog, buzzerEvents) {
  const stats = computeStats(m, questionEvents, buzzerEvents);
  const teams = getMatchTeams(m);
  const wb = XLSX.utils.book_new();

  // Sheet 1 — Ringkasan
  const s1 = [
    ["HASIL PERTANDINGAN — FINAL OLIMPIADE SAINS"],
    ["UNIVERSITAS TERBUKA"],
    [],
    ["Nomor Pertandingan", m.match_number],
    ["Tanggal", m.date],
    ["Nama Pertandingan", m.match_name],
    ["Jumlah Tim Peserta", teams.length],
    ...teams.map((t) => [`Tim ${t.id} (${t.name})`, `${t.school || "-"} | Skor Akhir: ${t.score}`]),
    ["Pemenang", winnersLabel(m)],
    ["Operator / Pelaksana", m.operator],
    ["Dewan Juri", m.juri],
    ["Waktu Mulai", fmtDateTime(m.created_at)],
    ["Waktu Selesai", fmtDateTime(m.finished_at)],
  ];
  const ws1 = XLSX.utils.aoa_to_sheet(s1);
  ws1["!cols"] = [{ wch: 28 }, { wch: 40 }];
  boldRow(ws1, 0, 2);
  XLSX.utils.book_append_sheet(wb, ws1, "Ringkasan");

  // Sheet 2 — Detail Soal
  const header2 = ["No", "Babak", "No Soal", "Tim Menjawab", "Hasil", "Poin", "Waktu Mulai", "Waktu Selesai", "Durasi Terpakai (detik)", "Catatan"];
  const rows2 = questionEvents.map((e, i) => [
    i + 1,
    e.round_type === "wajib" ? "Soal Wajib" : "Soal Rebutan",
    e.question_number,
    teamNameById(m, e.answering_team),
    resultLabel(e.result),
    e.points,
    fmtDateTime(e.started_at),
    fmtDateTime(e.ended_at),
    e.timer_used ?? "",
    e.note || "",
  ]);
  const ws2 = XLSX.utils.aoa_to_sheet([header2, ...rows2]);
  ws2["!cols"] = header2.map(() => ({ wch: 18 }));
  boldRow(ws2, 0, header2.length);
  XLSX.utils.book_append_sheet(wb, ws2, "Detail Soal");

  // Sheet 3 — Riwayat Skor
  const header3 = ["Waktu", "Tim", "Keterangan", "Perubahan Poin", "Total Poin", "Operator", "Catatan"];
  const rows3 = scoreLog.map((l) => [
    fmtDateTime(l.timestamp), teamNameById(m, l.team), l.event, l.points_change,
    l.score_after ?? "", l.operator || "-", l.correction_reason || "",
  ]);
  const ws3 = XLSX.utils.aoa_to_sheet([header3, ...rows3]);
  ws3["!cols"] = header3.map(() => ({ wch: 18 }));
  boldRow(ws3, 0, header3.length);
  XLSX.utils.book_append_sheet(wb, ws3, "Riwayat Skor");

  // Sheet 4 — Statistik
  const s4 = [
    ["STATISTIK PERTANDINGAN"], [],
    ["Total Soal Wajib", stats.totalWajib],
    ["Total Soal Rebutan", stats.totalRebutan],
    ["Jumlah Jawaban Benar", stats.benar],
    ["Jumlah Jawaban Salah", stats.salah],
    ["Jumlah Penalti", stats.penalti],
    ["Jumlah Rebutan Bel", stats.jumlahRebutan],
    ["Jumlah Bel Tanpa Jawaban", stats.belKosong],
    [],
    ["RINCIAN PEROLEHAN POIN TIM"],
    ...teams.map((t) => {
      const st = stats.teamStats[t.id] || {};
      return [`${t.name} (Tim ${t.id})`, `Skor Total: ${t.score} | Wajib: ${st.wajibPts} | Rebutan: ${st.rebPts} | Akurasi: ${st.pct}%`];
    }),
  ];
  const ws4 = XLSX.utils.aoa_to_sheet(s4);
  ws4["!cols"] = [{ wch: 32 }, { wch: 45 }];
  boldRow(ws4, 0, 2);
  XLSX.utils.book_append_sheet(wb, ws4, "Statistik");

  return wb;
}

function exportMatchExcel(m, questionEvents, scoreLog, buzzerEvents) {
  const wb = buildMatchWorkbook(m, questionEvents, scoreLog, buzzerEvents);
  XLSX.writeFile(wb, fileNameFor(m));
}

/* ============================== SETUP VIEW ============================== */

function SetupView({ onStart, onCancel, showCancel, theme }) {
  const [teamCount, setTeamCount] = useState(2);
  const [form, setForm] = useState({
    match_name: localStorage.getItem("app_event_title") || "Final Olimpiade Sains",
    match_number: "01",
    operator: "",
    juri: "",
    date: new Date().toISOString().slice(0, 10),
  });

  const [teams, setTeams] = useState([
    { id: "A", name: "Tim A", school: "UT Bandung", color: "blue" },
    { id: "B", name: "Tim B", school: "UT Jakarta", color: "red" },
  ]);

  const updateTeamCount = (count) => {
    setTeamCount(count);
    const letters = ["A", "B", "C", "D", "E", "F", "G", "H"];
    const colors = ["blue", "red", "emerald", "amber", "purple", "rose", "cyan", "indigo"];

    const newTeams = [];
    for (let i = 0; i < count; i++) {
      if (teams[i]) {
        newTeams.push(teams[i]);
      } else {
        newTeams.push({
          id: letters[i],
          name: `Tim ${letters[i]}`,
          school: `UT ${letters[i]}`,
          color: colors[i % colors.length],
        });
      }
    }
    setTeams(newTeams);
  };

  const updateTeamField = (index, field, val) => {
    setTeams((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: val };
      return next;
    });
  };

  const handleFormChange = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="max-w-4xl mx-auto py-10 px-4 md:px-6">
      <div className="text-center mb-10 flex flex-col items-center">
        <h1 className="text-3xl md:text-5xl font-black tracking-tight">Pengaturan Pertandingan</h1>
        <p className="opacity-75 mt-2 text-sm max-w-md mx-auto font-medium">Pilih jumlah tim peserta dan isi informasi babak pertandingan.</p>
      </div>

      <Panel className="p-6 md:p-10 space-y-8">
        <div>
          <label className="block text-xs font-black uppercase tracking-wider opacity-80 mb-3">JUMLAH TIM PESERTA</label>
          <div className="flex flex-wrap gap-2.5">
            {[2, 3, 4, 5, 6, 7, 8].map((n) => (
              <button
                key={n}
                onClick={() => updateTeamCount(n)}
                className={`px-5 py-3 rounded-xl font-black transition-all text-sm border ${teamCount === n ? "bg-[#FFE600] text-[#2C3592] border-amber-400 shadow-md scale-105" : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 dark:border-slate-700 opacity-90"}`}
              >
                {n} TIM
              </button>
            ))}
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-x-6 gap-y-2">
          <Field label="Nama Pertandingan">
            <input className={inputCls} value={form.match_name} onChange={handleFormChange("match_name")} placeholder="Final Olimpiade Sains 2026" />
          </Field>
          <Field label="Nomor Pertandingan">
            <input className={inputCls} value={form.match_number} onChange={handleFormChange("match_number")} placeholder="01" />
          </Field>
          <Field label="Tanggal Pertandingan">
            <input type="date" className={inputCls} value={form.date} onChange={handleFormChange("date")} />
          </Field>
          <Field label="Nama Operator / Pelaksana">
            <input className={inputCls} value={form.operator} onChange={handleFormChange("operator")} placeholder="Masukkan nama operator" />
          </Field>
          <Field label="Dewan Juri">
            <input className={inputCls} value={form.juri} onChange={handleFormChange("juri")} placeholder="Masukkan nama juri" />
          </Field>
        </div>

        <div>
          <h3 className="text-xs font-black uppercase tracking-wider opacity-80 mb-4">DATA TIM PESERTA</h3>
          <div className="grid md:grid-cols-2 gap-5">
            {teams.map((t, i) => {
              const colorInfo = getColor(t.color);
              const isLight = theme === "light";
              const borderCls = isLight ? colorInfo.borderLight : colorInfo.borderDark;
              const bgCls = isLight ? colorInfo.bgLight : colorInfo.bgDark;
              return (
                <div key={t.id} className={`border ${borderCls} bg-gradient-to-br ${bgCls} rounded-2xl p-5 shadow-sm space-y-3`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className={`${colorInfo.badge} text-xs font-black px-3.5 py-1 rounded-full uppercase`}>
                      TIM {t.id}
                    </span>
                    <select
                      value={t.color}
                      onChange={(e) => updateTeamField(i, "color", e.target.value)}
                      className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs font-extrabold border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1 focus:outline-none shadow-sm"
                    >
                      {TEAM_COLORS.map((c) => (
                        <option key={c.id} value={c.id} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">{c.label}</option>
                      ))}
                    </select>
                  </div>
                  <Field label={`Nama Tim ${t.id}`}>
                    <input className={inputCls} value={t.name} onChange={(e) => updateTeamField(i, "name", e.target.value)} placeholder={`Nama Tim ${t.id}`} />
                  </Field>
                  <Field label={`Instansi Tim ${t.id}`}>
                    <input className={inputCls} value={t.school} onChange={(e) => updateTeamField(i, "school", e.target.value)} placeholder={i === 0 ? "misal: UT Bandung" : i === 1 ? "misal: UT Jakarta" : `misal: UT ${t.id}`} />
                  </Field>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex gap-4 pt-4">
          {showCancel && <Btn tone="outline" onClick={onCancel} icon={ArrowLeft}>Batal</Btn>}
          <Btn tone="amber" size="lg" className="flex-1" icon={Play} onClick={() => onStart({ ...form, teams })}>
            MULAI PERTANDINGAN ({teamCount} TIM)
          </Btn>
        </div>
      </Panel>
    </div>
  );
}

const DEFAULT_RULES = {
  title: "Peraturan Pertandingan",
  subTitle: "Universitas Terbuka",
  eventTitle: "Final Olimpiade Sains 2026",
  wajibTitle: "Soal Wajib (+100)",
  wajibItems: [
    "Setiap tim mendapatkan satu amplop soal berjumlah 5 soal.",
    "Waktu menjawab setiap soal adalah 45 detik.",
    "Setiap pertanyaan harus dijawab benar dan sempurna. Jika tidak sempurna maka dinyatakan salah.",
    "Jawaban benar mendapatkan +100 poin.",
    "Soal dijawab oleh tim yang bersangkutan setelah soal selesai dibacakan.",
    "Pendamping/Official tidak diperkenankan protes kecuali terdapat soal atau jawaban yang meragukan.",
    "Keputusan dewan juri bersifat mutlak dan tidak dapat diganggu gugat."
  ],
  rebutanTitle: "Soal Rebutan (+150 / -50)",
  rebutanItems: [
    "Setiap putaran terdiri dari 10 soal.",
    "Waktu menjawab setiap soal adalah 45 detik.",
    "Semua peserta dari masing-masing tim dapat memberikan jawaban.",
    "Jawaban benar mendapatkan +150 poin.",
    "Jawaban salah atau tidak sempurna mendapatkan penalti -50 poin.",
    "Menekan bel tetapi tidak memberikan jawaban mendapatkan penalti -50 poin.",
    "Hak menjawab diberikan kepada tim yang lebih dahulu menekan bel.",
    "Jika bel ditekan saat soal dibacakan, pembacaan soal dihentikan dan tim dipersilakan menjawab.",
    "Keputusan dewan juri bersifat mutlak dan tidak dapat diganggu gugat."
  ]
};

function RulesView({ onBack, match }) {
  const [rules, setRules] = useState(() => {
    try {
      const saved = localStorage.getItem("custom_rules");
      return saved ? JSON.parse(saved) : DEFAULT_RULES;
    } catch (e) {
      return DEFAULT_RULES;
    }
  });

  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState(rules);

  const matchYear = match?.date ? new Date(match.date).getFullYear() : new Date().getFullYear();
  const matchTitle = editForm.eventTitle || rules.eventTitle || match?.match_name || localStorage.getItem("app_event_title") || `Final Olimpiade Sains ${matchYear}`;

  const handleSaveRules = () => {
    setRules(editForm);
    try {
      localStorage.setItem("custom_rules", JSON.stringify(editForm));
      if (editForm.eventTitle) {
        localStorage.setItem("app_event_title", editForm.eventTitle);
      }
    } catch (e) { }
    setIsEditing(false);
  };

  const handleResetDefault = () => {
    setRules(DEFAULT_RULES);
    setEditForm(DEFAULT_RULES);
    try {
      localStorage.removeItem("custom_rules");
    } catch (e) { }
    setIsEditing(false);
  };

  const updateItem = (category, index, value) => {
    setEditForm((prev) => {
      const nextItems = [...prev[category]];
      nextItems[index] = value;
      return { ...prev, [category]: nextItems };
    });
  };

  const addItem = (category) => {
    setEditForm((prev) => ({
      ...prev,
      [category]: [...prev[category], "Poin peraturan baru..."],
    }));
  };

  const removeItem = (category, index) => {
    setEditForm((prev) => ({
      ...prev,
      [category]: prev[category].filter((_, i) => i !== index),
    }));
  };

  return (
    <div className="max-w-4xl mx-auto py-10 px-4 md:px-6">
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <Btn tone="outline" icon={ArrowLeft} onClick={onBack}>Kembali</Btn>
        <div className="flex items-center gap-2">
          <Btn tone="amber" icon={Edit3} onClick={() => { setEditForm(rules); setIsEditing(true); }}>
            Edit Peraturan
          </Btn>
          {localStorage.getItem("custom_rules") && (
            <Btn tone="outline" icon={RotateCcw} onClick={handleResetDefault}>
              Reset Standar
            </Btn>
          )}
        </div>
      </div>

      <div className="mb-6">
        <h1 className="text-3xl font-black">{rules.title || "Peraturan Pertandingan"}</h1>
        <p className="opacity-75 text-sm font-medium">{rules.subTitle || "Universitas Terbuka"} — {matchTitle}</p>
      </div>

      <div className="space-y-6">
        <Panel className="p-6 md:p-8">
          <h2 className="text-xl font-black text-[#2C3592] dark:text-blue-400 mb-4 tracking-tight">
            {rules.wajibTitle}
          </h2>
          <ol className="list-decimal list-inside space-y-3 text-sm leading-relaxed opacity-90 font-medium">
            {rules.wajibItems.map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ol>
        </Panel>

        <Panel className="p-6 md:p-8">
          <h2 className="text-xl font-black text-red-700 dark:text-red-400 mb-4 tracking-tight">
            {rules.rebutanTitle}
          </h2>
          <ol className="list-decimal list-inside space-y-3 text-sm leading-relaxed opacity-90 font-medium">
            {rules.rebutanItems.map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ol>
        </Panel>
      </div>

      {/* Modal Edit Peraturan */}
      {isEditing && (
        <Modal title="Edit Peraturan Pertandingan" onClose={() => setIsEditing(false)}>
          <div className="space-y-5 max-h-[70vh] overflow-y-auto pr-2">
            <Field label="Nama Event & Tahun (contoh: Final Olimpiade Sains 2026)">
              <input
                className={inputCls}
                value={editForm.eventTitle || ""}
                onChange={(e) => setEditForm({ ...editForm, eventTitle: e.target.value })}
                placeholder="Final Olimpiade Sains 2026"
              />
            </Field>

            <Field label="Judul Utama Halaman">
              <input
                className={inputCls}
                value={editForm.title}
                onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
              />
            </Field>

            <Field label="Sub-Judul Instansi">
              <input
                className={inputCls}
                value={editForm.subTitle}
                onChange={(e) => setEditForm({ ...editForm, subTitle: e.target.value })}
              />
            </Field>

            {/* Wajib Section */}
            <div className="border-t pt-4">
              <Field label="Judul Babak Soal Wajib">
                <input
                  className={inputCls}
                  value={editForm.wajibTitle}
                  onChange={(e) => setEditForm({ ...editForm, wajibTitle: e.target.value })}
                />
              </Field>

              <label className="block text-xs font-black uppercase tracking-wider opacity-80 mb-2">
                Poin Peraturan Soal Wajib:
              </label>
              <div className="space-y-2">
                {editForm.wajibItems.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="text-xs font-bold opacity-60 w-5">{idx + 1}.</span>
                    <input
                      className={inputCls}
                      value={item}
                      onChange={(e) => updateItem("wajibItems", idx, e.target.value)}
                    />
                    <button
                      onClick={() => removeItem("wajibItems", idx)}
                      className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-950 rounded-lg"
                      title="Hapus poin"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <Btn tone="outline" size="sm" icon={Plus} onClick={() => addItem("wajibItems")}>
                  Tambah Poin Wajib
                </Btn>
              </div>
            </div>

            {/* Rebutan Section */}
            <div className="border-t pt-4">
              <Field label="Judul Babak Soal Rebutan">
                <input
                  className={inputCls}
                  value={editForm.rebutanTitle}
                  onChange={(e) => setEditForm({ ...editForm, rebutanTitle: e.target.value })}
                />
              </Field>

              <label className="block text-xs font-black uppercase tracking-wider opacity-80 mb-2">
                Poin Peraturan Soal Rebutan:
              </label>
              <div className="space-y-2">
                {editForm.rebutanItems.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="text-xs font-bold opacity-60 w-5">{idx + 1}.</span>
                    <input
                      className={inputCls}
                      value={item}
                      onChange={(e) => updateItem("rebutanItems", idx, e.target.value)}
                    />
                    <button
                      onClick={() => removeItem("rebutanItems", idx)}
                      className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-950 rounded-lg"
                      title="Hapus poin"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <Btn tone="outline" size="sm" icon={Plus} onClick={() => addItem("rebutanItems")}>
                  Tambah Poin Rebutan
                </Btn>
              </div>
            </div>

            <div className="flex gap-3 pt-4 border-t">
              <Btn tone="outline" className="flex-1" onClick={() => setIsEditing(false)}>Batal</Btn>
              <Btn tone="amber" className="flex-1" icon={Check} onClick={handleSaveRules}>SIMPAN PERATURAN</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ============================== MATCH LIST VIEW ============================== */

function MatchListView({ matches = [], onOpen, onNew, onDelete, onDeleteAll }) {
  const safeMatches = Array.isArray(matches) ? matches : [];
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteInput, setDeleteInput] = useState("");
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
  const [deleteAllInput, setDeleteAllInput] = useState("");

  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    if (deleteInput.trim().toLowerCase() === "hapus") {
      onDelete(deleteTarget.id);
      setDeleteTarget(null);
      setDeleteInput("");
    }
  };

  const handleConfirmDeleteAll = () => {
    if (deleteAllInput.trim().toUpperCase() === "HAPUS SEMUA") {
      onDeleteAll();
      setShowDeleteAllModal(false);
      setDeleteAllInput("");
    }
  };

  return (
    <div className="max-w-5xl mx-auto py-10 px-4 md:px-6">
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Daftar Pertandingan</h1>
        </div>
        <div className="flex items-center gap-3">
          {safeMatches.length > 0 && (
            <Btn tone="red" icon={Trash2} onClick={() => { setShowDeleteAllModal(true); setDeleteAllInput(""); }}>
              Hapus Semua Pertandingan
            </Btn>
          )}
          <Btn tone="amber" icon={PlusCircle} onClick={onNew}>Pertandingan Baru</Btn>
        </div>
      </div>

      <Panel className="p-6">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700/60 uppercase text-xs tracking-wider font-extrabold">
                <th className="py-3.5 px-3">No</th>
                <th className="py-3.5 px-3">Tanggal</th>
                <th className="py-3.5 px-3">Jumlah Tim</th>
                <th className="py-3.5 px-3">Tim & Perolehan Poin</th>
                <th className="py-3.5 px-3">Pemenang</th>
                <th className="py-3.5 px-3">Status</th>
                <th className="py-3.5 px-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {safeMatches.length === 0 && (
                <tr><td colSpan={7} className="py-12 text-center opacity-50 font-medium">Belum ada riwayat pertandingan. Klik "Pertandingan Baru" untuk memulai.</td></tr>
              )}
              {safeMatches.map((m) => {
                const teams = getMatchTeams(m);
                return (
                  <tr key={m.id} className="border-b border-slate-100 dark:border-slate-800/40 hover:bg-slate-100/60 dark:hover:bg-slate-800/30">
                    <td className="py-4 px-3 font-extrabold">{m.match_number}</td>
                    <td className="py-4 px-3 opacity-80 font-medium">{m.date}</td>
                    <td className="py-4 px-3 font-medium">{teams.length} Tim</td>
                    <td className="py-4 px-3">
                      <div className="flex flex-wrap gap-2">
                        {teams.map((t) => (
                          <span key={t.id} className="text-xs bg-blue-50 dark:bg-slate-800/90 text-[#2C3592] dark:text-amber-400 border border-blue-200 dark:border-slate-700 rounded-lg px-2.5 py-1 shadow-sm font-extrabold inline-flex items-center gap-1.5">
                            <span>{t.name}:</span>
                            <strong className="font-mono-num font-black">{t.score}</strong>
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-4 px-3 font-black text-[#D9A100] dark:text-amber-400">
                      {winnersLabel(m)}
                    </td>
                    <td className="py-4 px-3">
                      <span className={`text-xs px-3.5 py-1.5 rounded-full font-black inline-block shadow-sm ${m.status === "finished" ? "bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300" : "bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-950 dark:text-amber-300"}`}>
                        {m.status === "finished" ? "Selesai" : "Berlangsung"}
                      </span>
                    </td>
                    <td className="py-4 px-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Btn size="sm" tone="outline" icon={ChevronRight} onClick={() => onOpen(m.id)}>Buka</Btn>
                        <button
                          onClick={() => { setDeleteTarget(m); setDeleteInput(""); }}
                          className="p-2 rounded-xl text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/60 transition-colors border border-transparent hover:border-red-200 dark:hover:border-red-800"
                          title="Hapus Pertandingan"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* Delete Single Match Confirmation Modal */}
      {deleteTarget && (
        <Modal title="Hapus Pertandingan" onClose={() => setDeleteTarget(null)}>
          <div className="space-y-4">
            <div className="p-4 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-2xl text-rose-900 dark:text-rose-200 text-xs font-medium space-y-1">
              <div className="font-extrabold text-sm flex items-center gap-1.5 text-rose-700 dark:text-rose-400">
                <AlertTriangle className="w-4 h-4 shrink-0" /> Konfirmasi Penghapusan
              </div>
              <p>
                Anda akan menghapus data <strong>Pertandingan No. {deleteTarget.match_number}</strong> ({getMatchTeams(deleteTarget).map((t) => t.name).join(" vs ")}).
              </p>
            </div>

            <Field label="Konfirmasi Ketikan">
              <p className="text-xs opacity-75 mb-2 font-medium">
                Ketik kata <strong className="text-red-600 dark:text-red-400">HAPUS</strong> untuk mengaktifkan tombol hapus:
              </p>
              <input
                className={inputCls}
                value={deleteInput}
                onChange={(e) => setDeleteInput(e.target.value)}
                placeholder="Ketik HAPUS untuk konfirmasi"
                autoFocus
              />
            </Field>

            <div className="flex gap-3 pt-2">
              <Btn tone="outline" className="flex-1" onClick={() => setDeleteTarget(null)}>Batal</Btn>
              <Btn
                tone="red"
                className="flex-1 font-black"
                disabled={deleteInput.trim().toLowerCase() !== "hapus"}
                icon={Trash2}
                onClick={handleConfirmDelete}
              >
                HAPUS PERTANDINGAN
              </Btn>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete All Matches Confirmation Modal */}
      {showDeleteAllModal && (
        <Modal title="Hapus SEMUA Pertandingan" onClose={() => setShowDeleteAllModal(false)}>
          <div className="space-y-4">
            <div className="p-4 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-2xl text-rose-900 dark:text-rose-200 text-xs font-medium space-y-1">
              <div className="font-extrabold text-sm flex items-center gap-1.5 text-rose-700 dark:text-rose-400">
                <AlertTriangle className="w-4 h-4 shrink-0" /> Konfirmasi Penghapusan
              </div>
              <p>
                Tindakan ini akan menghapus <strong>SELURUH ({matches.length}) riwayat pertandingan</strong> secara permanen. Seluruh poin, data soal, dan rekap pertandingan akan hilang.
              </p>
            </div>

            <Field label="Konfirmasi Ketikan Wajib">
              <p className="text-xs opacity-75 mb-2 font-medium">
                Untuk mengonfirmasi penghapusan seluruh pertandingan, ketik kata <strong className="text-red-600 dark:text-red-400">HAPUS SEMUA</strong>:
              </p>
              <input
                className={inputCls}
                value={deleteAllInput}
                onChange={(e) => setDeleteAllInput(e.target.value)}
                placeholder="Ketik HAPUS SEMUA untuk konfirmasi"
                autoFocus
              />
            </Field>

            <div className="flex gap-3 pt-2">
              <Btn tone="outline" className="flex-1" onClick={() => setShowDeleteAllModal(false)}>Batal</Btn>
              <Btn
                tone="red"
                className="flex-1"
                disabled={deleteAllInput.trim().toUpperCase() !== "HAPUS SEMUA"}
                icon={Trash2}
                onClick={handleConfirmDeleteAll}
              >
                HAPUS SEMUA PERTANDINGAN
              </Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ============================== PROJECTOR VIEW ============================== */

function ProjectorView({ match, timerDisplay, timerDuration, timerRunning, statusMessage, onExit, theme }) {
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
        <UtLogo className="h-20 w-auto mb-4 bg-white p-2.5 rounded-2xl shadow-md border border-slate-200" />
        <h2 className="text-2xl font-black mb-2">Tidak Ada Pertandingan Aktif</h2>
        <p className="opacity-75 text-sm max-w-md mb-6 font-medium">Silakan buat pertandingan baru atau buka dari Daftar Pertandingan.</p>
        <Btn tone="amber" icon={ArrowLeft} onClick={onExit}>Kembali</Btn>
      </div>
    );
  }

  const teams = getMatchTeams(match);
  const roundLabel = match.round_type === "wajib" ? "SOAL WAJIB" : "SOAL REBUTAN";
  const activeWajibTeam = statusMessage || teams[0]?.id || "A";
  const qNum = match.round_type === "wajib"
    ? getWajibQnum(match, activeWajibTeam)
    : match.rebutan_qnum || 1;
  const qMax = match.round_type === "wajib" ? 5 : 10;

  let gridCols = "grid-cols-2";
  if (teams.length === 3) gridCols = "grid-cols-1 md:grid-cols-3";
  else if (teams.length === 4) gridCols = "grid-cols-2 md:grid-cols-4";
  else if (teams.length >= 5) gridCols = "grid-cols-2 md:grid-cols-3 lg:grid-cols-4";

  return (
    <div className={`min-h-screen w-full flex flex-col p-6 md:p-10 justify-between relative overflow-hidden transition-colors ${isLight ? "bg-gradient-to-br from-indigo-50/90 via-slate-50 to-blue-50/90 text-slate-900" : "bg-slate-900 text-white"}`}>
      {/* Full-Height Background Watermark Logo */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden opacity-10 z-0 p-4">
        <UtLogo className="h-[82vh] w-auto max-w-[85vw] object-contain filter drop-shadow-2xl" />
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

      {/* Header Banner (FINAL OLIMPIADE SAINS & UNIVERSITAS TERBUKA) */}
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
        <div className="font-bold text-base md:text-xl opacity-80 mb-2">PERTANYAAN KE-{qNum} DARI {qMax}</div>
        <TimerBlock seconds={timerDisplay} duration={timerDuration} running={timerRunning} size="xl" theme={theme} />
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

/* ============================== RECAP VIEW ============================== */

function RecapView({ match, questionEvents, scoreLog, buzzerEvents, onBack, onDownload, onListMatches, theme }) {
  const stats = computeStats(match, questionEvents, buzzerEvents);
  const teams = getMatchTeams(match);

  return (
    <div className="max-w-5xl mx-auto py-10 px-4 md:px-6 space-y-8">
      <Btn tone="outline" icon={ArrowLeft} onClick={onBack}>Kembali ke Pertandingan</Btn>

      <div className="text-center flex flex-col items-center">
        <div className="text-[#D9A100] dark:text-amber-400 font-black tracking-widest text-xs uppercase mb-2">
          {match?.match_name || "FINAL OLIMPIADE SAINS"}
        </div>
        <h1 className="text-3xl md:text-5xl font-black tracking-tight">Hasil Akhir Pertandingan</h1>
        <p className="opacity-75 text-sm mt-1 font-medium">Pertandingan No. {match.match_number} — {match.date}</p>
      </div>

      <Panel className="p-6 md:p-10 space-y-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 items-center">
          {teams.map((t) => {
            const colorInfo = getColor(t.color);
            const isLight = theme === "light";
            const textColor = isLight ? colorInfo.textLight : colorInfo.textDark;
            return (
              <div key={t.id} className="text-center p-5 border border-slate-200 dark:border-slate-700/60 rounded-2xl bg-white/60 dark:bg-slate-800/30 shadow-sm">
                <div className={`font-extrabold text-lg ${textColor}`}>{t.name}</div>
                <div className="opacity-60 text-xs mb-3 font-medium">{t.school || "-"}</div>
                <div className={`font-mono-num font-black text-5xl ${textColor}`}>{t.score}</div>
              </div>
            );
          })}
        </div>
        <div className="text-center pt-4">
          <div className="inline-flex items-center gap-3 bg-[#FFE600] text-[#2C3592] font-black text-xl md:text-2xl px-8 py-4 rounded-2xl shadow-xl">
            <Trophy className="w-8 h-8" /> JUARA PERTANDINGAN: {winnersLabel(match).toUpperCase()}
          </div>
        </div>
      </Panel>

      <Panel className="p-6 md:p-8">
        <h3 className="font-black text-lg mb-4">Ringkasan Penilaian Tim</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700/60 text-left opacity-70 text-xs uppercase font-black">
                <th className="py-3">Tim Peserta</th>
                <th className="py-3 text-right">Skor Total</th>
                <th className="py-3 text-right">Poin Wajib</th>
                <th className="py-3 text-right">Poin Rebutan</th>
                <th className="py-3 text-right">Jawaban Benar</th>
                <th className="py-3 text-right">Akurasi Jawaban</th>
              </tr>
            </thead>
            <tbody>
              {teams.map((t) => {
                const st = stats.teamStats[t.id] || {};
                return (
                  <tr key={t.id} className="border-b border-slate-100 dark:border-slate-800/40">
                    <td className="py-3.5 font-extrabold">{t.name}</td>
                    <td className="py-3.5 text-right font-mono-num font-black">{t.score}</td>
                    <td className="py-3.5 text-right font-mono-num font-bold text-[#2C3592] dark:text-blue-400">{st.wajibPts}</td>
                    <td className="py-3.5 text-right font-mono-num font-bold text-red-600 dark:text-red-400">{st.rebPts}</td>
                    <td className="py-3.5 text-right font-mono-num text-emerald-600 dark:text-emerald-400 font-bold">{st.totalBenar} / {st.totalAttempt}</td>
                    <td className="py-3.5 text-right font-mono-num font-black text-[#D9A100] dark:text-amber-400">{st.pct}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel className="p-6 md:p-8">
        <h3 className="font-black text-lg mb-4">Riwayat Perolehan Poin</h3>
        <HistoryTable scoreLog={scoreLog} match={match} compact={false} />
      </Panel>

      <div className="flex gap-4 flex-wrap pt-2">
        <Btn tone="amber" size="lg" icon={Download} onClick={onDownload}>UNDUH REKAP EXCEL (.XLSX)</Btn>
        <Btn tone="outline" size="lg" icon={ListChecks} onClick={onListMatches}>Daftar Pertandingan</Btn>
      </div>
    </div>
  );
}

/* ============================== DASHBOARD VIEW ============================== */

function RoomCodeEntryView({ defaultCode, onConnectRoom, onClearRoom }) {
  const [code, setCode] = useState(defaultCode || "");

  useEffect(() => {
    if (defaultCode) setCode(defaultCode);
  }, [defaultCode]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (code.trim()) {
      onConnectRoom(code.trim().toUpperCase());
    }
  };

  return (
    <div className="w-full flex-1 flex flex-col items-center justify-center py-4 px-4 max-w-md mx-auto min-h-[50vh]">
      <Panel className="w-full p-4 md:p-5 space-y-3 shadow-xl text-center">
        <div className="flex flex-col items-center">
          <h2 className="text-xl md:text-2xl font-black tracking-tight">Masuk Room Lomba</h2>
          <p className="opacity-80 text-xs mt-1 max-w-xs mx-auto font-medium">
            {defaultCode
              ? `Kode Room "${defaultCode}" tidak memiliki pertandingan aktif. Masukkan kode room lain, buat pertandingan baru, atau hapus kode room.`
              : "Masukkan Kode Pertandingan untuk terhubung langsung ke Room Lomba real-time."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-2 text-left pt-0.5">
          <Field label="Kode Pertandingan (Room Code)" className="block mb-1">
            <input
              className={`${inputCls} font-mono-num text-center tracking-widest text-base font-bold uppercase py-1.5 px-3 shadow-inner`}
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="contoh: UOG-2176"
              autoFocus
            />
          </Field>

          <div className="flex gap-2">
            {defaultCode && (
              <Btn
                tone="outline"
                size="md"
                className="flex-1 text-red-600 border-red-300 hover:bg-red-50 dark:hover:bg-red-950 font-black text-xs whitespace-nowrap py-1.5"
                onClick={onClearRoom}
              >
                HAPUS KODE ROOM
              </Btn>
            )}
            <Btn
              tone="amber"
              size="md"
              className="flex-1 shadow-md font-black text-xs whitespace-nowrap py-1.5"
              icon={Swords}
              onClick={handleSubmit}
            >
              HUBUNGKAN ROOM
            </Btn>
          </div>
        </form>

        <div className="relative flex py-0.5 items-center">
          <div className="flex-grow border-t border-slate-200 dark:border-slate-700"></div>
          <span className="flex-shrink mx-3 text-xs font-bold opacity-60">ATAU</span>
          <div className="flex-grow border-t border-slate-200 dark:border-slate-700"></div>
        </div>

        <div className="flex flex-row gap-2 w-full">
          <Btn
            tone="outline"
            size="md"
            className="flex-1 text-xs font-bold whitespace-nowrap px-2 py-1.5"
            icon={ListChecks}
            onClick={() => navigateTo("/matches")}
          >
            Daftar Pertandingan
          </Btn>
          <Btn
            tone="blue"
            size="md"
            className="flex-1 text-xs font-bold whitespace-nowrap px-2 py-1.5"
            icon={PlusCircle}
            onClick={() => navigateTo("/setup")}
          >
            Pertandingan Baru
          </Btn>
        </div>
      </Panel>
    </div>
  );
}

function DashboardView(props) {
  const {
    match, setMatch, questionEvents, setQuestionEvents, scoreLog, commitScore,
    timerDisplay, timerDuration, setTimerDuration, timerRunning,
    startTimer, pauseTimer, resetTimer,
    soundOn, setSoundOn, sounds,
    onOpenProjector, onOpenRecap, onOpenRules, onOpenMatchList,
    onFinishMatch, theme, onConnectRoom, roomId, onSwitchRoom, triggerBuzzRef,
    onClearRoom,
  } = props;

  if (!match) {
    return <RoomCodeEntryView defaultCode={roomId} onConnectRoom={onConnectRoom} onClearRoom={onClearRoom} />;
  }

  const teams = getMatchTeams(match);
  const [answeringTeam, setAnsweringTeam] = useState(teams[0]?.id || "A");
  const [currentEventId, setCurrentEventId] = useState(null);
  const [buzzedTeam, setBuzzedTeam] = useState(null);
  const [buzzerLocked, setBuzzerLocked] = useState(false);
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [correctTeamId, setCorrectTeamId] = useState(teams[0]?.id || "A");
  const [correctPoints, setCorrectPoints] = useState(100);
  const [correctReason, setCorrectReason] = useState("");

  const currentEvent = questionEvents.find((e) => e.id === currentEventId) || null;
  const isWajib = match.round_type === "wajib";
  const matchPaused = match.status === "paused";
  const isLight = theme === "light";

  useEffect(() => {
    if (teams.length > 0 && !teams.some((t) => t.id === answeringTeam)) {
      setAnsweringTeam(teams[0].id);
    }
  }, [teams, answeringTeam]);

  function triggerBuzz(teamId) {
    if (isWajib || buzzerLocked || buzzedTeam) return;
    setBuzzedTeam(teamId);
    setBuzzerLocked(true);
    setAnsweringTeam(teamId);

    const teamIdx = teams.findIndex((t) => t.id === teamId);
    sounds.buzzTeam(teamIdx >= 0 ? teamIdx : 0);

    if (roomId) {
      broadcastBuzzer(roomId, teamId);
    }

    const ev = {
      id: uid(),
      match_id: match.id,
      round_type: "rebutan",
      question_number: match.rebutan_qnum || 1,
      answering_team: teamId,
      result: null,
      points: 0,
      started_at: nowIso(),
      ended_at: null,
      timer_used: 0,
      note: `Soal Rebutan`,
    };
    setQuestionEvents((prev) => [...prev, ev]);
    setCurrentEventId(ev.id);
    startTimer(timerDuration);
  }

  useEffect(() => {
    if (triggerBuzzRef) {
      triggerBuzzRef.current = triggerBuzz;
    }
  });

  function cancelBuzzer() {
    pauseTimer();
    setBuzzedTeam(null);
    setBuzzerLocked(false);
    resetTimer(timerDuration);
  }

  /* ---------------- KEYBOARD SHORTCUTS LISTENER ---------------- */
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (["INPUT", "TEXTAREA", "SELECT"].includes(e.target?.tagName)) return;

      const key = e.key.toLowerCase();

      // Space: Toggle Timer
      if (e.code === "Space") {
        e.preventDefault();
        if (timerRunning) pauseTimer();
        else {
          if (isWajib) startWajibTimer();
          else startTimer(timerDuration);
        }
        return;
      }

      // Escape: Cancel Bel / Reset Buzzer
      if (e.code === "Escape") {
        e.preventDefault();
        cancelBuzzer();
        return;
      }

      // Rebutan Team Buzzers (A-H or 1-8)
      if (!isWajib && !buzzedTeam && !buzzerLocked) {
        const keyToTeamIdx = {
          a: 0, 1: 0,
          b: 1, 2: 1,
          c: 2, 3: 2,
          d: 3, 4: 3,
          e: 4, 5: 4,
          f: 5, 6: 5,
          g: 6, 7: 6,
          h: 7, 8: 7,
        };

        if (keyToTeamIdx[key] !== undefined) {
          const idx = keyToTeamIdx[key];
          if (teams[idx]) {
            e.preventDefault();
            triggerBuzz(teams[idx].id);
            return;
          }
        }
      }

      // Judgement Shortcuts (Y / Enter = Benar, N / Backspace = Salah)
      if (isWajib || buzzedTeam) {
        if (key === "y" || e.code === "Enter") {
          e.preventDefault();
          if (isWajib) resolveWajib("benar");
          else resolveRebutan("benar");
        } else if (key === "n" || e.code === "Backspace") {
          e.preventDefault();
          if (isWajib) resolveWajib("salah");
          else resolveRebutan("salah");
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isWajib, buzzedTeam, buzzerLocked, timerRunning, teams, answeringTeam, currentEventId, timerDuration]);

  useEffect(() => {
    props.setTimeUpHandler(() => () => {
      if (isWajib) {
        if (currentEventId) resolveWajib("waktu_habis");
      } else {
        if (currentEventId && !buzzedTeam) resolveRebutanTimeout();
      }
    });
  }, [isWajib, currentEventId, buzzedTeam, questionEvents]);

  /* ---------------- WAJIB ACTIONS ---------------- */

  function startWajibTimer() {
    if (!answeringTeam || timerRunning || matchPaused) return;
    let ev = currentEvent;
    const currentQnum = getWajibQnum(match, answeringTeam);
    if (!ev) {
      ev = {
        id: uid(),
        match_id: match.id,
        round_type: "wajib",
        question_number: currentQnum,
        answering_team: answeringTeam,
        result: null,
        points: 0,
        started_at: nowIso(),
        ended_at: null,
        timer_used: 0,
        note: `Soal Wajib Tim ${answeringTeam}`,
      };
      setQuestionEvents((prev) => [...prev, ev]);
      setCurrentEventId(ev.id);
    }
    startTimer(timerDuration);
  }

  function resolveWajib(result) {
    pauseTimer();
    sounds[result === "benar" ? "correct" : "wrong"]();
    const pts = result === "benar" ? 100 : 0;

    if (currentEventId) {
      setQuestionEvents((prev) => prev.map((e) => e.id === currentEventId ? { ...e, result, points: pts, ended_at: nowIso(), timer_used: timerDuration - timerDisplay } : e));
    }

    commitScore(answeringTeam, pts, `Soal Wajib (${resultLabel(result)})`);

    setMatch((prev) => {
      if (!prev) return prev;
      return incrementWajibQnum(prev, answeringTeam);
    });

    setCurrentEventId(null);
    resetTimer(timerDuration);
  }

  /* ---------------- REBUTAN ACTIONS ---------------- */

  function resolveRebutan(result) {
    pauseTimer();
    sounds[result === "benar" ? "correct" : "wrong"]();
    const pts = result === "benar" ? 150 : -50;
    const targetTeam = buzzedTeam || answeringTeam;

    if (currentEventId) {
      setQuestionEvents((prev) => prev.map((e) => e.id === currentEventId ? { ...e, result, answering_team: targetTeam, points: pts, ended_at: nowIso(), timer_used: timerDuration - timerDisplay } : e));
    }

    commitScore(targetTeam, pts, `Soal Rebutan (${resultLabel(result)})`);

    setMatch((prev) => (prev ? { ...prev, round_type: "rebutan", status: "rebutan", rebutan_qnum: (prev.rebutan_qnum || 1) + 1 } : prev));
    setCurrentEventId(null);
    setBuzzedTeam(null);
    setBuzzerLocked(false);
    resetTimer(timerDuration);
  }

  function resolveRebutanTimeout() {
    pauseTimer();
    sounds.wrong();
    if (currentEventId) {
      setQuestionEvents((prev) => prev.map((e) => e.id === currentEventId ? { ...e, result: "waktu_habis", points: 0, ended_at: nowIso() } : e));
    }
    setMatch((prev) => ({ ...prev, rebutan_qnum: (prev.rebutan_qnum || 1) + 1 }));
    setCurrentEventId(null);
    setBuzzedTeam(null);
    setBuzzerLocked(false);
    resetTimer(timerDuration);
  }

  function handleManualScoreCorrection() {
    if (!correctTeamId) return;
    const pts = parseInt(correctPoints, 10) || 0;
    commitScore(correctTeamId, pts, `Koreksi Poin Manual (${correctReason || "Koreksi Juri"})`);
    setShowCorrectionModal(false);
    setCorrectReason("");
  }

  let gridCols = "grid-cols-2";
  if (teams.length === 3) gridCols = "grid-cols-1 md:grid-cols-3";
  else if (teams.length === 4) gridCols = "grid-cols-2 md:grid-cols-4";
  else if (teams.length >= 5) gridCols = "grid-cols-2 md:grid-cols-3 lg:grid-cols-4";

  return (
    <div className="max-w-6xl mx-auto py-6 px-4 md:px-6 space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-black uppercase tracking-wider px-3 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
            PERTANDINGAN NO. {match.match_number}
          </span>
          <span className="text-xs font-bold opacity-75">{match.date}</span>
        </div>
        <div className="flex items-center gap-2.5">
          <Btn tone="outline" size="sm" icon={Edit3} onClick={() => setShowCorrectionModal(true)}>
            Koreksi Poin
          </Btn>
          <button
            onClick={() => setSoundOn(!soundOn)}
            className={`p-2 rounded-xl border shadow-sm transition-all ${isLight ? "bg-white text-emerald-600 border-slate-300 hover:bg-slate-50" : "bg-slate-800 text-emerald-400 border-slate-700 hover:bg-slate-700"}`}
            title="Efek Suara"
          >
            {soundOn ? <Volume2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> : <VolumeX className="w-4 h-4 text-red-600 dark:text-red-400" />}
          </button>
          <Btn tone="amber" size="sm" icon={Trophy} onClick={onFinishMatch}>
            Selesaikan Pertandingan
          </Btn>
        </div>
      </div>

      {/* Round Switcher Banner */}
      <Panel className="p-5 flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4 flex-wrap">
          <span className="text-xs font-black uppercase tracking-wider opacity-70">BABAK AKTIF:</span>
          <div className={`inline-flex rounded-xl p-1 border ${isLight ? "bg-slate-100 border-slate-200" : "bg-slate-800/80 border-slate-700"}`}>
            <button
              onClick={() => setMatch((m) => (m ? { ...m, round_type: "wajib", status: "wajib" } : m))}
              className={`px-5 py-2.5 rounded-lg font-black text-sm transition-all ${isWajib ? "bg-[#2C3592] text-white shadow-md" : isLight ? "text-slate-600 hover:text-slate-900" : "opacity-70 hover:opacity-100"}`}
            >
              SOAL WAJIB (+100)
            </button>
            <button
              onClick={() => setMatch((m) => (m ? { ...m, round_type: "rebutan", status: "rebutan" } : m))}
              className={`px-5 py-2.5 rounded-lg font-black text-sm transition-all ${!isWajib ? "bg-red-600 text-white shadow-md" : isLight ? "text-slate-600 hover:text-slate-900" : "opacity-70 hover:opacity-100"}`}
            >
              SOAL REBUTAN (+150 / -50)
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-extrabold uppercase tracking-wider opacity-75">Durasi Waktu:</span>
          <div className="flex items-center gap-1.5">
            {[30, 45, 60].map((d) => (
              <button
                key={d}
                onClick={() => {
                  setTimerDuration(d);
                  resetTimer(d);
                }}
                className={`px-3.5 py-1.5 text-xs rounded-xl font-extrabold border transition-all ${timerDuration === d ? "bg-[#FFE600] text-[#2C3592] border-amber-400 shadow-sm scale-105" : isLight ? "bg-white text-slate-700 border-slate-300 hover:bg-slate-100" : "border-slate-700 bg-slate-800 text-slate-200 opacity-80 hover:opacity-100"}`}
              >
                {d} Detik
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800/80 px-2.5 py-1 rounded-xl border border-slate-300 dark:border-slate-700 shadow-sm">
            <span className="text-xs font-extrabold opacity-75">Kustom:</span>
            <input
              type="number"
              min="1"
              max="600"
              className="w-14 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-0.5 text-center font-mono-num font-black text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#2C3592]"
              value={timerDuration}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val) && val > 0 && val <= 600) {
                  setTimerDuration(val);
                  resetTimer(val);
                } else if (e.target.value === "") {
                  setTimerDuration("");
                }
              }}
              placeholder="45"
            />
            <span className="text-xs font-extrabold opacity-75">Detik</span>
          </div>
        </div>
      </Panel>

      {/* Team Cards Grid */}
      <div className={`grid ${gridCols} gap-5`}>
        {teams.map((t) => (
          <TeamCard
            key={t.id}
            team={t}
            theme={theme}
            active={answeringTeam === t.id}
            gettingAnswer={buzzedTeam === t.id}
            onSelect={() => setAnsweringTeam(t.id)}
          />
        ))}
      </div>

      {/* Main Game Control Panel */}
      <Panel className="p-6 md:p-8 space-y-6">
        <div className="grid md:grid-cols-2 gap-8 items-center">
          {/* Left Column: Timer */}
          <div className={`flex flex-col items-center justify-center p-6 border rounded-2xl shadow-sm ${isLight ? "bg-slate-50 border-slate-200" : "bg-slate-800/20 border-slate-700/60"}`}>
            <span className="text-xs font-black uppercase tracking-wider opacity-70 mb-3">WAKTU MENJAWAB</span>
            <TimerBlock seconds={timerDisplay} duration={timerDuration} running={timerRunning} theme={theme} />
            <div className="flex gap-3 mt-6">
              {!timerRunning ? (
                <Btn tone="emerald" size="lg" icon={Play} onClick={isWajib ? startWajibTimer : () => startTimer(timerDuration)}>
                  MULAI WAKTU
                </Btn>
              ) : (
                <Btn tone="amber" size="lg" icon={Pause} onClick={pauseTimer}>
                  JEDA WAKTU
                </Btn>
              )}
              <Btn tone="outline" size="lg" icon={RotateCcw} onClick={() => resetTimer(timerDuration)}>
                ULANGI WAKTU
              </Btn>
            </div>
          </div>

          {/* Right Column: Actions */}
          <div>
            {isWajib ? (
              <div className="space-y-5">
                <div>
                  <div className="text-sm font-black text-[#2C3592] dark:text-blue-400 uppercase tracking-wider mb-1">
                    PENILAIAN SOAL WAJIB ({teamNameById(match, answeringTeam).toUpperCase()}) — SOAL KE-{getWajibQnum(match, answeringTeam)}
                  </div>
                  <p className="text-xs opacity-70 font-medium">Jalankan waktu di sebelah kiri, kemudian tentukan hasil jawaban tim.</p>
                </div>

                <div className="flex flex-col gap-3.5">
                  <Btn tone="emerald" size="lg" icon={CheckCircle2} onClick={() => resolveWajib("benar")}>
                    JAWABAN BENAR (+100 POIN) <span className="text-xs opacity-75 font-mono ml-1">[Enter / Y]</span>
                  </Btn>
                  <Btn tone="red" size="lg" icon={XCircle} onClick={() => resolveWajib("salah")}>
                    JAWABAN SALAH (0 POIN) <span className="text-xs opacity-75 font-mono ml-1">[Backspace / N]</span>
                  </Btn>
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="text-sm font-black text-red-600 dark:text-red-400 uppercase tracking-wider">
                  PENILAIAN SOAL REBUTAN (+150 / -50) — SOAL KE-{(match.rebutan_qnum || 1)}
                </div>

                {!buzzedTeam ? (
                  <div>
                    <label className="block text-xs font-extrabold uppercase tracking-wider opacity-70 mb-3">
                      PILIH TIM YANG MENEKAN BEL TERCEPAT:
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      {teams.map((t, idx) => {
                        const colorInfo = getColor(t.color);
                        const keyLabel = idx === 0 ? "1 / A" : idx === 1 ? "2 / B" : idx === 2 ? "3 / C" : idx === 3 ? "4 / D" : idx === 4 ? "5 / E" : idx === 5 ? "6 / F" : idx === 6 ? "7 / G" : "8 / H";
                        return (
                          <button
                            key={t.id}
                            onClick={() => triggerBuzz(t.id)}
                            className={`p-3.5 rounded-xl font-black text-sm border ${colorInfo.badge} hover:scale-[1.02] transition-all shadow-sm flex items-center justify-between gap-2`}
                          >
                            <span className="flex items-center gap-1.5">🔔 BEL {t.name}</span>
                            <span className="text-[10px] px-2 py-0.5 rounded-md bg-black/10 dark:bg-white/20 font-mono font-bold uppercase">[{keyLabel}]</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3.5">
                    <div className="p-4 bg-[#FFE600] text-[#2C3592] font-black rounded-xl text-center text-sm animate-pulse shadow-md flex items-center justify-between">
                      <span>🔔 {teamNameById(match, buzzedTeam).toUpperCase()} MENEKAN BEL!</span>
                      <button onClick={cancelBuzzer} className="text-xs bg-red-600 text-white px-2.5 py-1 rounded-lg hover:bg-red-700 transition-colors" title="Batal Tekan Bel (Esc)">
                        Batal (Esc)
                      </button>
                    </div>
                    <Btn tone="emerald" size="lg" className="w-full" icon={CheckCircle2} onClick={() => resolveRebutan("benar")}>
                      BENAR (+150 POIN) <span className="text-xs opacity-75 font-mono ml-1">[Enter / Y]</span>
                    </Btn>
                    <Btn tone="red" size="lg" className="w-full" icon={XCircle} onClick={() => resolveRebutan("salah")}>
                      SALAH / PENALTI (-50 POIN) <span className="text-xs opacity-75 font-mono ml-1">[Backspace / N]</span>
                    </Btn>
                    <Btn tone="outline" size="md" className="w-full text-xs" icon={RotateCcw} onClick={cancelBuzzer}>
                      BATAL BEL / RESET (ESC)
                    </Btn>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </Panel>

      {/* History Log Table */}
      <Panel className="p-6 md:p-8">
        <h3 className="font-black text-base mb-4">Riwayat Perolehan Poin</h3>
        <HistoryTable scoreLog={scoreLog} match={match} compact={true} />
      </Panel>

      {/* Correction Modal */}
      {showCorrectionModal && (
        <Modal title="Koreksi Poin Manual" onClose={() => setShowCorrectionModal(false)}>
          <div className="space-y-4">
            <Field label="Pilih Tim">
              <select
                className={inputCls}
                value={correctTeamId}
                onChange={(e) => setCorrectTeamId(e.target.value)}
              >
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>{t.name} (Skor Saat Ini: {t.score})</option>
                ))}
              </select>
            </Field>
            <Field label="Jumlah Perubahan Poin (+/-)">
              <input
                type="number"
                className={inputCls}
                value={correctPoints}
                onChange={(e) => setCorrectPoints(e.target.value)}
                placeholder="contoh: 100 atau -50"
              />
            </Field>
            <Field label="Alasan / Catatan Koreksi">
              <input
                className={inputCls}
                value={correctReason}
                onChange={(e) => setCorrectReason(e.target.value)}
                placeholder="misal: Koreksi juri soal no 3"
              />
            </Field>
            <div className="flex gap-3 pt-2">
              <Btn tone="outline" className="flex-1" onClick={() => setShowCorrectionModal(false)}>Batal</Btn>
              <Btn tone="amber" className="flex-1" icon={Check} onClick={handleManualScoreCorrection}>SIMPAN KOREKSI</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ============================== BUZZER PLAYER VIEW (PARTICIPANT) ============================== */

function BuzzerPlayerView({ roomId, match, syncStatus, onConnectRoom, sounds, theme }) {
  const teams = getMatchTeams(match);
  const [selectedTeamId, setSelectedTeamId] = useState(() => {
    return localStorage.getItem("participant_team_id") || "A";
  });
  const [flashBg, setFlashBg] = useState(false);

  const handleSelectTeam = (id) => {
    setSelectedTeamId(id);
    localStorage.setItem("participant_team_id", id);
  };

  const handleBuzzPress = useCallback(() => {
    if (!roomId) return;
    if (sounds && sounds.buzzTeam) {
      sounds.buzzTeam(teams.findIndex((t) => t.id === selectedTeamId) || 0);
    }
    setFlashBg(true);
    setTimeout(() => setFlashBg(false), 400);

    broadcastBuzzer(roomId, selectedTeamId);
  }, [roomId, selectedTeamId, teams, sounds]);

  /* Keyboard shortcut listener for Participant (Spacebar, Enter, or any key) */
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (["INPUT", "TEXTAREA", "SELECT"].includes(e.target?.tagName)) return;
      if (e.repeat) return;
      e.preventDefault();
      handleBuzzPress();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleBuzzPress]);

  const currentTeamObj = teams.find((t) => t.id === selectedTeamId) || teams[0] || { id: "A", name: "Tim A", color: "blue" };
  const colorInfo = getColor(currentTeamObj.color || "blue");
  const isLight = theme === "light";

  return (
    <div className={`min-h-screen flex flex-col justify-between p-4 md:p-8 transition-colors ${flashBg ? "bg-amber-400" : isLight ? "bg-slate-100 text-slate-900" : "bg-slate-950 text-white"}`}>
      {/* Top Header */}
      <div className="flex items-center justify-between gap-4 max-w-2xl mx-auto w-full">
        <div className="flex items-center gap-3">
          <UtLogo className="h-10 w-auto bg-white p-1 rounded-xl shadow-sm border border-slate-200" />
          <div>
            <div className="text-xs font-black tracking-wider uppercase text-[#2C3592] dark:text-amber-400">UNIVERSITAS TERBUKA</div>
            <h1 className="text-lg font-black tracking-tight">Bel Peserta Olimpiade</h1>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-white dark:bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-800 shadow-sm text-xs font-extrabold">
          <span className={`w-2.5 h-2.5 rounded-full ${syncStatus === "connected" ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`} />
          <span>Room: <strong className="font-mono text-sm">{roomId || "OFFLINE"}</strong></span>
        </div>
      </div>

      {/* Main Center Area: Team Selector & Giant 3D Buzzer Button */}
      <div className="max-w-xl mx-auto w-full flex flex-col items-center justify-center my-6 space-y-6">
        {/* Team Selector Pills */}
        <div className="w-full">
          <label className="block text-center text-xs font-black uppercase tracking-wider opacity-70 mb-2">PILIH TIM PESERTA ANDA:</label>
          <div className="flex flex-wrap justify-center gap-2">
            {teams.map((t) => {
              const selected = selectedTeamId === t.id;
              const tColor = getColor(t.color);
              return (
                <button
                  key={t.id}
                  onClick={() => handleSelectTeam(t.id)}
                  className={`px-4 py-2 rounded-xl text-xs font-black transition-all border shadow-sm ${selected ? `${tColor.badge} scale-105 ring-2 ring-amber-400 shadow-md` : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700 opacity-70 hover:opacity-100"}`}
                >
                  TIM {t.id} ({t.name})
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Team Banner */}
        <div className={`w-full p-4 rounded-2xl border-2 text-center shadow-md bg-gradient-to-br ${isLight ? colorInfo.bgLight : colorInfo.bgDark} ${isLight ? colorInfo.borderLight : colorInfo.borderDark}`}>
          <span className={`${colorInfo.badge} text-xs px-3 py-1 rounded-full uppercase tracking-wider shadow-sm`}>ANDA ADALAH TIM {currentTeamObj.id}</span>
          <div className="text-xl md:text-2xl font-black mt-1">{currentTeamObj.name}</div>
          <div className="text-xs opacity-75 font-medium">{currentTeamObj.school || "-"}</div>
        </div>

        {/* Giant Tactile 3D Bel Button */}
        <div className="w-full flex flex-col items-center justify-center py-4">
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
        </div>

        <div className="text-center opacity-70 text-xs font-medium max-w-xs">
          💡 Tips: Anda dapat menekan layar bel ini, mengeklik mouse, atau menekan tombol <strong>SPACEBAR / ENTER</strong> di keyboard PC/Laptop Anda.
        </div>
      </div>

      {/* Footer Navigation */}
      <div className="max-w-2xl mx-auto w-full text-center border-t border-slate-200 dark:border-slate-800 pt-4 flex items-center justify-between text-xs opacity-75">
        <span>Universitas Terbuka — {match?.match_name || "Final Olimpiade Sains"}</span>
        <button onClick={() => navigateTo("/room", { id: roomId })} className="font-bold underline hover:opacity-100">Buka Layar Operator</button>
      </div>
    </div>
  );
}

/* ============================== MAIN APP COMPONENT ============================== */

export default function App() {
  const [theme, setTheme] = useState("light");
  const [viewState, setViewState] = useState(() => parseLocation());

  /* Sync URL location state instantly across header clicks and popstate */
  useEffect(() => {
    const handleLocationChange = (newParsed) => {
      const parsed = newParsed || parseLocation();
      setViewState(parsed);
    };

    navSubscribers.add(handleLocationChange);
    const popHandler = () => handleLocationChange();
    window.addEventListener("popstate", popHandler);

    return () => {
      navSubscribers.delete(handleLocationChange);
      window.removeEventListener("popstate", popHandler);
    };
  }, []);

  const toggleTheme = () => setTheme((t) => (t === "light" ? "dark" : "light"));

  /* Apply theme class to <html> element accurately with Tailwind darkMode: "class" */
  useEffect(() => {
    if (theme === "light") {
      document.documentElement.classList.remove("dark", "theme-dark");
      document.documentElement.classList.add("theme-light");
      document.documentElement.className = "theme-light";
    } else {
      document.documentElement.classList.remove("theme-light");
      document.documentElement.classList.add("dark", "theme-dark");
      document.documentElement.className = "dark theme-dark";
    }
    localStorage.setItem("theme", theme);
  }, [theme]);

  const [matches, setMatches] = useState([]);
  const [match, setMatch] = useState(null);
  const [questionEvents, setQuestionEvents] = useState([]);
  const [scoreLog, setScoreLog] = useState([]);
  const [buzzerEvents, setBuzzerEvents] = useState([]);
  const [timerDuration, setTimerDuration] = useState(45);
  const [timerDisplay, setTimerDisplay] = useState(45);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerStartedAt, setTimerStartedAt] = useState(null);
  const [soundOn, setSoundOn] = useState(true);
  const [statusMessage, setStatusMessage] = useState(null);

  /* Real-time Sync Room ID */
  const [roomId, setRoomId] = useState(() => {
    const parsed = parseLocation();
    if (parsed.roomParam) return parsed.roomParam.toUpperCase();
    return "";
  });

  const [syncStatus, setSyncStatus] = useState("disconnected");
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [joinRoomInput, setJoinRoomInput] = useState("");
  const [copiedLink, setCopiedLink] = useState(false);

  const sounds = useSoundEngine(soundOn);
  const soundsRef = useRef(sounds);
  useEffect(() => { soundsRef.current = sounds; }, [sounds]);
  const timeUpHandlerRef = useRef(null);
  const lastLocalUpdateRef = useRef(0);
  const isRemoteSyncRef = useRef(false);
  const triggerBuzzRef = useRef(null);

  /* ---------------- TIMER LOGIC ---------------- */
  useEffect(() => {
    let iv = null;
    if (timerRunning) {
      iv = setInterval(() => {
        if (timerStartedAt) {
          const elapsed = Math.floor((Date.now() - timerStartedAt) / 1000);
          const remaining = Math.max(0, timerDuration - elapsed);
          setTimerDisplay(remaining);
          if (remaining <= 0) {
            setTimerRunning(false);
            setTimerStartedAt(null);
            if (soundsRef.current) soundsRef.current.timeUp();
            if (timeUpHandlerRef.current) timeUpHandlerRef.current()();
          } else if (remaining <= 5 && soundsRef.current) {
            soundsRef.current.tenLeft();
          }
        } else {
          setTimerDisplay((prev) => {
            if (prev <= 1) {
              setTimerRunning(false);
              if (soundsRef.current) soundsRef.current.timeUp();
              if (timeUpHandlerRef.current) timeUpHandlerRef.current()();
              return 0;
            }
            if (prev <= 6 && prev >= 2 && soundsRef.current) {
              soundsRef.current.tenLeft();
            }
            return prev - 1;
          });
        }
      }, 1000);
    }
    return () => {
      if (iv) clearInterval(iv);
    };
  }, [timerRunning, timerStartedAt, timerDuration]);

  const startTimer = (d) => {
    const dur = d || timerDuration || 45;
    const now = Date.now();
    lastLocalUpdateRef.current = now;
    setTimerDuration(dur);
    setTimerDisplay(dur);
    setTimerStartedAt(now);
    setTimerRunning(true);
    sounds.timerStart();
  };
  const pauseTimer = () => {
    lastLocalUpdateRef.current = Date.now();
    setTimerRunning(false);
    setTimerStartedAt(null);
  };
  const resetTimer = (d) => {
    const dur = d || timerDuration || 45;
    lastLocalUpdateRef.current = Date.now();
    setTimerRunning(false);
    setTimerStartedAt(null);
    setTimerDisplay(dur);
  };

  const setTimeUpHandler = useCallback((fn) => { timeUpHandlerRef.current = fn; }, []);

  /* ---------------- REAL-TIME MQTT SYNC ---------------- */

  const handleIncomingSync = useCallback((msg) => {
    if (!msg) return;

    if (msg.type === "BUZZER_PRESS" && msg.teamId) {
      if (soundsRef.current) soundsRef.current.buzzTeam(0);
      if (triggerBuzzRef.current) {
        triggerBuzzRef.current(msg.teamId);
      }
      return;
    }

    if (msg.timestamp && lastLocalUpdateRef.current && msg.timestamp < lastLocalUpdateRef.current - 500) {
      return;
    }

    if (msg.type === "GLOBAL_MATCHES_INDEX" && Array.isArray(msg.payload)) {
      setMatches(msg.payload);
      try {
        window.storage.set("matches-index", JSON.stringify(msg.payload), false).catch(() => {});
      } catch (e) {}
      return;
    }

    if (msg.type === "SYNC_STATE" && msg.payload) {
      isRemoteSyncRef.current = true;
      const data = msg.payload;
      if (data.match && data.match.id) {
        setMatch(data.match);
        setMatches((prevList) => {
          const idx = prevList.findIndex((x) => x.id === data.match.id);
          const entry = {
            id: data.match.id,
            match_number: data.match.match_number,
            match_name: data.match.match_name,
            date: data.match.date,
            teams: getMatchTeams(data.match),
            status: data.match.status,
            winner: data.match.winner,
            room_code: data.match.room_code || roomId,
          };
          let next;
          if (idx === -1) next = [...prevList, entry];
          else { next = [...prevList]; next[idx] = entry; }
          try {
            window.storage.set("matches-index", JSON.stringify(next), false).catch(() => {});
            window.storage.set(`match:${data.match.id}`, JSON.stringify({
              match: data.match,
              questionEvents: data.questionEvents || [],
              scoreLog: data.scoreLog || data.match.score_log || [],
              buzzerEvents: []
            }), false).catch(() => {});
          } catch (e) {}
          return next;
        });
      }
      if (data.questionEvents) setQuestionEvents(data.questionEvents);
      if (data.scoreLog && Array.isArray(data.scoreLog)) {
        setScoreLog(data.scoreLog);
      } else if (data.match && Array.isArray(data.match.score_log)) {
        setScoreLog(data.match.score_log);
      }
      if (data.buzzerEvents) setBuzzerEvents(data.buzzerEvents);
      if (typeof data.timerRunning === "boolean") setTimerRunning(data.timerRunning);
      if (typeof data.timerDuration === "number") setTimerDuration(data.timerDuration);
      if (data.timerStartedAt !== undefined) setTimerStartedAt(data.timerStartedAt);
      if (!data.timerRunning && typeof data.timerDisplay === "number") {
        setTimerDisplay(data.timerDisplay);
      }
    }
  }, []);

  const connectToRoom = (code) => {
    const targetCode = code ? code.toUpperCase().trim() : "GLOBAL";
    setRoomId(targetCode === "GLOBAL" ? null : targetCode);
    if (targetCode !== "GLOBAL") {
      localStorage.setItem("active_room", targetCode);
    }
    setActiveSyncRoom(targetCode);

    initSyncEngine(
      targetCode,
      (msg) => handleIncomingSync(msg),
      (st) => setSyncStatus(st)
    );
  };

  useEffect(() => {
    const initialRoom = roomId || (typeof window !== "undefined" && localStorage.getItem("active_room")) || "GLOBAL";
    connectToRoom(initialRoom);
  }, []);

  /* Broadcast matches index globally whenever matches list updates */
  useEffect(() => {
    if (matches && matches.length > 0) {
      broadcastGlobalMatchesIndex(matches);
    }
  }, [matches]);

  /* ---------------- REAL-TIME BROADCAST VIA MQTT ---------------- */
  useEffect(() => {
    if (isRemoteSyncRef.current) {
      isRemoteSyncRef.current = false;
      return;
    }
    if (!match || !roomId) return;
    broadcastState(roomId, {
      match,
      questionEvents,
      scoreLog,
      buzzerEvents,
      timerRunning,
      timerDisplay,
      timerDuration,
      timerStartedAt,
    });
  }, [match, questionEvents, scoreLog, buzzerEvents, timerRunning, timerDuration, timerStartedAt, roomId]);

  /* ---------------- STORAGE: LOAD INDEX ---------------- */
  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get("matches-index");
        if (res && res.value) {
          const list = JSON.parse(res.value);
          setMatches(list);
          if (list && list.length > 0) {
            broadcastGlobalMatchesIndex(list);
          }
        }
      } catch (e) { }
    })();
  }, []);

  /* Load specific match if URL has match parameter */
  useEffect(() => {
    if (viewState.matchParam) {
      openMatch(viewState.matchParam, false);
    }
  }, [viewState.matchParam]);

  /* ---------------- STORAGE: PERSIST MATCH ---------------- */
  const saveTimeout = useRef(null);
  useEffect(() => {
    if (!match) return;
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(async () => {
      try {
        await window.storage.set(`match:${match.id}`, JSON.stringify({ match, questionEvents, scoreLog, buzzerEvents }), false);
        setMatches((prevList) => {
          const idx = prevList.findIndex((x) => x.id === match.id);
          const entry = {
            id: match.id,
            match_number: match.match_number,
            date: match.date,
            teams: getMatchTeams(match),
            status: match.status,
            winner: match.winner
          };
          let next;
          if (idx === -1) next = [...prevList, entry];
          else { next = [...prevList]; next[idx] = entry; }
          window.storage.set("matches-index", JSON.stringify(next), false).catch(() => { });
          return next;
        });
      } catch (e) { console.error("Gagal menyimpan data pertandingan", e); }
    }, 350);
  }, [match, questionEvents, scoreLog, buzzerEvents]);

  /* ---------------- SCORING HELPERS ---------------- */

  function commitScore(teamId, points, eventLabel) {
    let latestLogEntry = null;

    setMatch((prev) => {
      if (!prev) return prev;
      const teams = getMatchTeams(prev);
      const teamIdx = teams.findIndex((t) => t.id === teamId);
      if (teamIdx === -1) return prev;

      const before = teams[teamIdx].score || 0;
      const after = before + points;

      const updatedTeams = [...teams];
      updatedTeams[teamIdx] = { ...updatedTeams[teamIdx], score: after };

      latestLogEntry = {
        id: uid(),
        match_id: prev.id,
        team: teamId,
        event: eventLabel,
        points_change: points,
        score_before: before,
        score_after: after,
        operator: prev.operator || "-",
        timestamp: nowIso(),
      };

      const existingLogs = Array.isArray(prev.score_log) ? prev.score_log : [];
      return {
        ...prev,
        teams: updatedTeams,
        score_log: [...existingLogs, latestLogEntry],
      };
    });

    if (latestLogEntry) {
      setScoreLog((prevLog) => [...prevLog, latestLogEntry]);
    }
  }

  /* ---------------- MATCH LIFECYCLE ---------------- */

  function startNewMatch(form) {
    const newRoom = generateRoomId();
    connectToRoom(newRoom);

    if (form.match_name) {
      try { localStorage.setItem("app_event_title", form.match_name); } catch (e) { }
    }

    const m = {
      id: uid(),
      room_code: newRoom,
      match_number: form.match_number || "01",
      match_name: form.match_name || localStorage.getItem("app_event_title") || "Final Olimpiade Sains",
      date: form.date,
      teams: form.teams || [
        { id: "A", name: "Tim A", school: "UT Bandung", score: 0, color: "blue" },
        { id: "B", name: "Tim B", school: "UT Jakarta", score: 0, color: "red" },
      ],
      operator: form.operator || "-",
      juri: form.juri || "-",
      status: "wajib",
      round_type: "wajib",
      winner: null,
      wajib_a_qnum: 1,
      wajib_b_qnum: 1,
      rebutan_qnum: 1,
      timer_duration: 45,
      created_at: nowIso(),
      finished_at: null,
    };
    setMatch(m);
    setQuestionEvents([]);
    setScoreLog([]);
    setBuzzerEvents([]);
    setTimerDuration(45);
    resetTimer(45);
    navigateTo("/room", { id: newRoom, match: m.id });
  }

  async function openMatch(id, doNavigate = true) {
    try {
      const res = await window.storage.get(`match:${id}`);
      if (res && res.value) {
        const data = JSON.parse(res.value);
        let matchCode = data.match.room_code || data.match.code;
        if (!matchCode || !/^[A-Z]{3}-\d{4}$/.test(matchCode)) {
          matchCode = generateRoomId();
          data.match.room_code = matchCode;
          window.storage.set(`match:${id}`, JSON.stringify(data), false).catch(() => { });
        }

        connectToRoom(matchCode);
        setMatch(data.match);
        setQuestionEvents(data.questionEvents || []);
        setScoreLog(data.scoreLog || []);
        setBuzzerEvents(data.buzzerEvents || []);
        setTimerDuration(data.match.timer_duration || 45);
        resetTimer(data.match.timer_duration || 45);
        if (doNavigate) {
          if (data.match.status === "finished") {
            navigateTo("/recap", { id: data.match.id });
          } else {
            navigateTo("/room", { id: matchCode, match: id });
          }
        }
      }
    } catch (e) { console.error("Gagal memuat data pertandingan."); }
  }

  async function deleteMatch(matchId) {
    try {
      await window.storage.set(`match:${matchId}`, null, false);
    } catch (e) { }

    setMatches((prev) => {
      const next = prev.filter((m) => m.id !== matchId);
      window.storage.set("matches-index", JSON.stringify(next), false).catch(() => { });
      broadcastGlobalMatchesIndex(next);
      return next;
    });

    if (match && match.id === matchId) {
      setMatch(null);
      setQuestionEvents([]);
      setScoreLog([]);
      setBuzzerEvents([]);
    }
  }

  async function deleteAllMatches() {
    try {
      for (const m of matches) {
        await window.storage.set(`match:${m.id}`, null, false);
      }
      await window.storage.set("matches-index", "[]", false);
    } catch (e) { }

    setMatches([]);
    broadcastGlobalMatchesIndex([]);
    setMatch(null);
    setQuestionEvents([]);
    setScoreLog([]);
    setBuzzerEvents([]);
  }

  function finishMatch() {
    setMatch((prev) => {
      const teams = getMatchTeams(prev);
      const maxScore = Math.max(...teams.map((t) => t.score));
      const topTeams = teams.filter((t) => t.score === maxScore);
      const winner = topTeams.length === 1 ? topTeams[0].id : "SERI";
      return { ...prev, status: "finished", winner, finished_at: nowIso() };
    });
    navigateTo("/recap", { id: match?.id || "" });
  }

  const copyLiveLink = () => {
    const url = `${window.location.origin}/room?id=${roomId}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const isLight = theme === "light";
  const currentView = viewState.view;

  if (currentView === "projector") {
    return (
      <ProjectorView
        match={match}
        timerDisplay={timerDisplay}
        timerDuration={timerDuration}
        timerRunning={timerRunning}
        statusMessage={statusMessage}
        onExit={() => navigateTo("/room", { id: roomId })}
        theme={theme}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col transition-colors">
      {/* Top Header Navbar (Single Row Layout, Ultra Elegant & Clean) */}
      <header className={`border-b sticky top-0 z-40 px-2.5 md:px-6 py-2 shadow-md transition-colors ${isLight ? "bg-white text-slate-900 border-slate-200" : "bg-[#2C3592] text-white border-[#1E256C]"}`}>
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-1.5 md:gap-3 flex-nowrap">
          {/* Left Brand */}
          <div className="flex items-center gap-2 shrink-0 cursor-pointer whitespace-nowrap" onClick={() => navigateTo("/setup")}>
            <UtLogo className="h-7 md:h-8 w-auto shrink-0 bg-white p-0.5 rounded-lg shadow-sm border border-amber-300" />
            <div className="hidden lg:block whitespace-nowrap">
              <div className={`font-black text-xs md:text-sm tracking-tight leading-none ${isLight ? "text-[#2C3592]" : "text-white"}`}>
                UNIVERSITAS TERBUKA
              </div>
              <div className={`text-[10px] md:text-xs font-black tracking-wider uppercase mt-0.5 ${isLight ? "text-amber-600" : "text-[#FFE600]"}`}>
                {match?.match_name || (typeof window !== "undefined" && localStorage.getItem("app_event_title")) || "FINAL OLIMPIADE SAINS"}
              </div>
            </div>
          </div>

          {/* Center Navigation Tabs (1 Single Line, No Wrapping, No Scrollbar) */}
          <nav className="flex items-center gap-1 md:gap-1.5 shrink-0 whitespace-nowrap">
            <button
              onClick={() => navigateTo("/setup")}
              className={`px-2 py-1.5 md:px-2.5 md:py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 ${currentView === "setup" ? "bg-[#FFE600] text-[#2C3592] shadow-sm" : isLight ? "text-slate-700 hover:bg-slate-100" : "text-slate-200 hover:bg-[#1E256C]"}`}
            >
              <Settings2 className="w-3.5 h-3.5" /> <span className="hidden sm:inline whitespace-nowrap">Pengaturan</span>
            </button>
            <button
              onClick={() => navigateTo("/room", { id: roomId, match: match?.id })}
              className={`px-2 py-1.5 md:px-2.5 md:py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 ${currentView === "dashboard" ? "bg-[#FFE600] text-[#2C3592] shadow-sm" : isLight ? "text-slate-700 hover:bg-slate-100" : "text-slate-200 hover:bg-[#1E256C]"}`}
            >
              <Swords className="w-3.5 h-3.5" /> <span className="hidden sm:inline whitespace-nowrap">Room Lomba</span>
            </button>
            <button
              onClick={() => navigateTo("/matches")}
              className={`px-2 py-1.5 md:px-2.5 md:py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 ${currentView === "matches" ? "bg-[#FFE600] text-[#2C3592] shadow-sm" : isLight ? "text-slate-700 hover:bg-slate-100" : "text-slate-200 hover:bg-[#1E256C]"}`}
            >
              <ListChecks className="w-3.5 h-3.5" /> <span className="hidden sm:inline whitespace-nowrap">Daftar Pertandingan</span>
            </button>
            <button
              onClick={() => navigateTo("/rules")}
              className={`px-2 py-1.5 md:px-2.5 md:py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 ${currentView === "rules" ? "bg-[#FFE600] text-[#2C3592] shadow-sm" : isLight ? "text-slate-700 hover:bg-slate-100" : "text-slate-200 hover:bg-[#1E256C]"}`}
            >
              <BookOpen className="w-3.5 h-3.5" /> <span className="hidden sm:inline whitespace-nowrap">Peraturan</span>
            </button>
            <button
              onClick={() => navigateTo("/projector", { room: roomId })}
              className={`px-2 py-1.5 md:px-2.5 md:py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 ${currentView === "projector" ? "bg-[#FFE600] text-[#2C3592] shadow-sm" : isLight ? "text-slate-700 hover:bg-slate-100" : "text-slate-200 hover:bg-[#1E256C]"}`}
            >
              <Tv className="w-3.5 h-3.5" /> <span className="hidden sm:inline whitespace-nowrap">Layar Besar</span>
            </button>
            <button
              onClick={() => navigateTo("/buzzer", { room: roomId })}
              className={`px-2 py-1.5 md:px-2.5 md:py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 ${currentView === "buzzer" ? "bg-[#FFE600] text-[#2C3592] shadow-sm" : isLight ? "text-slate-700 hover:bg-slate-100" : "text-slate-200 hover:bg-[#1E256C]"}`}
            >
              <Radio className="w-3.5 h-3.5 text-red-500" /> <span className="hidden sm:inline whitespace-nowrap">Bel Peserta</span>
            </button>
          </nav>

          {/* Right Controls (Kode Pertandingan & Theme Switcher) */}
          <div className="flex items-center gap-1 shrink-0 whitespace-nowrap">
            {(currentView === "dashboard" || currentView === "projector" || currentView === "buzzer") && (
              (match && roomId) ? (
                <div className="flex items-center gap-1 whitespace-nowrap shrink-0">
                  <button
                    onClick={copyLiveLink}
                    className={`flex items-center gap-1 border rounded-xl px-2 py-1.5 text-xs font-black shadow-sm transition-all hover:scale-105 whitespace-nowrap shrink-0 ${isLight ? "bg-[#FFE600] text-[#2C3592] border-amber-400" : "bg-[#1E256C] text-white border-[#3E47A8]"}`}
                    title="Klik untuk menyalin tautan pertandingan langsung"
                  >
                    <span className={`w-2 h-2 rounded-full ${syncStatus === "connected" ? "bg-emerald-600 dark:bg-emerald-400 animate-pulse" : "bg-amber-600"}`} />
                    <span className="whitespace-nowrap">Kode: <strong className="font-mono-num text-xs tracking-wider">{roomId}</strong></span>
                    {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5 opacity-80" />}
                  </button>
                  <button
                    onClick={() => {
                      setJoinRoomInput(roomId || "");
                      setShowRoomModal(true);
                    }}
                    className={`flex items-center gap-1 text-xs font-black border rounded-xl px-2 py-1.5 shadow-sm transition-all whitespace-nowrap shrink-0 ${isLight ? "bg-white text-slate-800 border-slate-300 hover:bg-slate-100" : "bg-[#1E256C] text-slate-100 border-[#3E47A8] hover:bg-[#252E80]"}`}
                    title="Ubah / Pindah Kode Room"
                  >
                    <Radio className="w-3.5 h-3.5 text-amber-500" /> <span className="hidden sm:inline whitespace-nowrap">PINDAH ROOM</span>
                  </button>
                </div>
              ) : (
                <button onClick={() => setShowRoomModal(true)} className="flex items-center gap-1 text-xs font-black bg-[#FFE600] text-[#2C3592] border border-amber-300 rounded-xl px-2 py-1.5 hover:bg-amber-300 shadow-sm transition-all whitespace-nowrap shrink-0">
                  <Radio className="w-3.5 h-3.5" /> <span className="hidden sm:inline whitespace-nowrap">KODE ROOM</span>
                </button>
              )
            )}

            <button onClick={toggleTheme} className={`p-1.5 rounded-xl border shadow-sm transition-all shrink-0 ${isLight ? "bg-white text-slate-800 border-slate-300 hover:bg-slate-50" : "bg-[#1E256C] text-[#FFE600] border-[#3E47A8] hover:bg-[#252E80]"}`} title="Ubah Mode Tampilan (Terang/Gelap)">
              {isLight ? <Moon className="w-4 h-4 text-slate-800" /> : <Sun className="w-4 h-4 text-[#FFE600]" />}
            </button>
          </div>
        </div>
      </header>

      {/* Main View Area */}
      <main className="flex-1">
        {currentView === "setup" && (
          <SetupView
            onStart={startNewMatch}
            onCancel={() => navigateTo("/room", { id: roomId })}
            showCancel={!!match}
            theme={theme}
          />
        )}

        {currentView === "buzzer" && (
          <BuzzerPlayerView
            roomId={roomId}
            match={match}
            syncStatus={syncStatus}
            onConnectRoom={connectToRoom}
            sounds={sounds}
            theme={theme}
          />
        )}

        {currentView === "dashboard" && (
          <DashboardView
            match={match}
            setMatch={setMatch}
            questionEvents={questionEvents}
            setQuestionEvents={setQuestionEvents}
            scoreLog={scoreLog}
            commitScore={commitScore}
            timerDisplay={timerDisplay}
            timerDuration={timerDuration}
            setTimerDuration={setTimerDuration}
            timerRunning={timerRunning}
            startTimer={startTimer}
            pauseTimer={pauseTimer}
            resetTimer={resetTimer}
            soundOn={soundOn}
            setSoundOn={setSoundOn}
            sounds={sounds}
            setTimeUpHandler={setTimeUpHandler}
            triggerBuzzRef={triggerBuzzRef}
            onOpenProjector={() => navigateTo("/projector", { room: roomId })}
            onOpenRecap={() => navigateTo("/recap", { id: match?.id })}
            onOpenRules={() => navigateTo("/rules")}
            onOpenMatchList={() => navigateTo("/matches")}
            onFinishMatch={finishMatch}
            theme={theme}
            onConnectRoom={connectToRoom}
            onClearRoom={() => {
              setRoomId(null);
              navigateTo("/room");
            }}
            roomId={roomId}
          />
        )}

        {currentView === "recap" && match && (
          <RecapView
            match={match}
            questionEvents={questionEvents}
            scoreLog={scoreLog}
            buzzerEvents={buzzerEvents}
            onBack={() => navigateTo("/room", { id: roomId })}
            onDownload={() => exportMatchExcel(match, questionEvents, scoreLog, buzzerEvents)}
            onListMatches={() => navigateTo("/matches")}
            theme={theme}
          />
        )}

        {currentView === "rules" && <RulesView match={match} onBack={() => navigateTo("/room", { id: roomId })} />}

        {currentView === "matches" && (
          <MatchListView
            matches={matches}
            onOpen={openMatch}
            onNew={() => navigateTo("/setup")}
            onDelete={deleteMatch}
            onDeleteAll={deleteAllMatches}
          />
        )}
      </main>

      {/* Join Room Modal */}
      {showRoomModal && (
        <Modal title="Hubungkan Layar / Perangkat Lain" onClose={() => setShowRoomModal(false)}>
          <div className="space-y-3">
            <p className="text-xs opacity-75 leading-relaxed font-medium">
              Masukkan Kode Pertandingan untuk menampilkan perolehan poin & waktu secara langsung di layar proyektor atau perangkat juri/operator lain.
            </p>
            <Field label="Kode Pertandingan (contoh: UOG-2176)" className="block mb-2">
              <input
                className={`${inputCls} font-mono-num text-center tracking-wider text-base font-bold uppercase py-2 px-3`}
                value={joinRoomInput}
                onChange={(e) => setJoinRoomInput(e.target.value.toUpperCase())}
                placeholder="Masukkan Kode Pertandingan"
                autoFocus
              />
            </Field>
            <div className="flex gap-2 pt-1">
              {roomId && (
                <Btn
                  tone="outline"
                  size="md"
                  className="flex-1 text-red-600 border-red-300 hover:bg-red-50 dark:hover:bg-red-950 font-black text-xs"
                  onClick={() => {
                    setRoomId(null);
                    setShowRoomModal(false);
                    navigateTo("/room");
                  }}
                >
                  HAPUS KODE ROOM
                </Btn>
              )}
              <Btn
                tone="blue"
                className="flex-1 font-black text-xs"
                size="md"
                disabled={!joinRoomInput.trim()}
                onClick={() => {
                  if (joinRoomInput.trim()) {
                    connectToRoom(joinRoomInput.trim().toUpperCase());
                    setShowRoomModal(false);
                    navigateTo("/room", { id: joinRoomInput.trim().toUpperCase() });
                  }
                }}
              >
                HUBUNGKAN
              </Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-slate-100 text-slate-900">
          <UtLogo className="h-16 w-auto mb-4 bg-white p-2 rounded-2xl shadow-md border border-slate-200" />
          <h2 className="text-2xl font-black mb-2">Terjadi Kesalahan Aplikasi</h2>
          <p className="opacity-75 text-sm max-w-md mb-6 font-medium">
            Aplikasi mengalami kendala saat memuat data ({this.state.error?.message || "Unknown error"}).
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => {
                localStorage.clear();
                window.location.href = "/matches";
              }}
              className="px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl shadow-md transition-all text-sm"
            >
              Reset Data & Muat Ulang
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-5 py-2.5 bg-[#2C3592] hover:bg-[#1E256C] text-white font-bold rounded-xl shadow-md transition-all text-sm"
            >
              Muat Ulang Halaman
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export function RootApp() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}
