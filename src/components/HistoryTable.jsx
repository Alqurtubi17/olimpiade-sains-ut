import React from "react";
import { fmtDateTime, teamNameById } from "../utils/helpers.js";

export function HistoryTable({ scoreLog = [], match, compact }) {
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
