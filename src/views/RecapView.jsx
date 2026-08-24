import React from "react";
import { ArrowLeft, Trophy, Download, ListChecks } from "lucide-react";
import { Btn, Panel } from "../components/UI.jsx";
import { HistoryTable } from "../components/HistoryTable.jsx";
import { getColor } from "../constants.js";
import { getMatchTeams, computeStats, winnersLabel } from "../utils/helpers.js";

export function RecapView({ match, questionEvents, scoreLog, buzzerEvents, onBack, onDownload, onListMatches, theme }) {
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
        <div className="flex flex-wrap items-center justify-center gap-4 md:gap-6">
          {teams.map((t) => {
            const colorInfo = getColor(t.color);
            const isLight = theme === "light";
            const textColor = isLight ? colorInfo.textLight : colorInfo.textDark;
            return (
              <div key={t.id} className="text-center p-5 border border-slate-200 dark:border-slate-700/60 rounded-2xl bg-white/60 dark:bg-slate-800/30 shadow-sm min-w-[180px] md:min-w-[220px] flex-1 max-w-[260px]">
                <div className={`font-extrabold text-lg ${textColor}`}>{t.name}</div>
                <div className="opacity-60 text-xs mb-3 font-medium">{t.school || "-"}</div>
                <div className={`font-mono-num font-black text-5xl ${textColor}`}>{t.score}</div>
              </div>
            );
          })}
        </div>
        <div className="text-[#D9A100] dark:text-amber-400 font-black text-center pt-4">
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
