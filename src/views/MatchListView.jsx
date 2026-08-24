import React, { useState } from "react";
import { Trash2, PlusCircle, ChevronRight, AlertTriangle } from "lucide-react";
import { Btn, Panel, Modal } from "../components/UI.jsx";
import { getMatchTeams, winnersLabel } from "../utils/helpers.js";
import { inputCls } from "../constants.js";

export function MatchListView({ matches = [], onOpen, onNew, onDelete, onDeleteAll }) {
  const safeMatches = Array.isArray(matches) ? matches : [];
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteInput, setDeleteInput] = useState("");
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
  const [deleteAllInput, setDeleteAllInput] = useState("");

  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    onDelete(deleteTarget.id);
    setDeleteTarget(null);
    setDeleteInput("");
  };

  const handleConfirmDeleteAll = () => {
    onDeleteAll();
    setShowDeleteAllModal(false);
    setDeleteAllInput("");
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
                <th className="py-3.5 px-3">Kode Room</th>
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
                <tr><td colSpan={8} className="py-12 text-center opacity-50 font-medium">Belum ada riwayat pertandingan. Klik "Pertandingan Baru" untuk memulai.</td></tr>
              )}
              {safeMatches.map((m) => {
                const teams = getMatchTeams(m);
                const roomCode = m.room_code || m.roomCode || "-";
                return (
                  <tr key={m.id} className="border-b border-slate-100 dark:border-slate-800/40 hover:bg-slate-100/60 dark:hover:bg-slate-800/30">
                    <td className="py-4 px-3 font-extrabold">{m.match_number}</td>
                    <td className="py-4 px-3">
                      <span className="font-mono text-xs font-black bg-blue-50 dark:bg-slate-800 text-[#2C3592] dark:text-amber-400 px-2.5 py-1 rounded-lg border border-blue-200 dark:border-slate-700 shadow-sm uppercase tracking-wider">
                        {roomCode}
                      </span>
                    </td>
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
        <Modal title="Hapus Pertandingan" onClose={() => setDeleteTarget(null)} bodyClassName="p-4 md:p-5">
          <div className="space-y-3">
            <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-2xl text-rose-900 dark:text-rose-200 text-xs font-medium space-y-1">
              <div className="font-extrabold text-sm flex items-center gap-1.5 text-rose-700 dark:text-rose-400">
                <AlertTriangle className="w-4 h-4 shrink-0" /> Konfirmasi Penghapusan
              </div>
              <p>
                Menghapus data <strong>Pertandingan No. {deleteTarget.match_number}</strong> ({getMatchTeams(deleteTarget).map((t) => t.name).join(" vs ")}).
              </p>
            </div>

            <div>
              <label className="block text-xs font-extrabold opacity-80 mb-1">
                Ketik <strong className="text-rose-600 dark:text-rose-400 font-mono">"{deleteTarget.match_number}"</strong> untuk mengonfirmasi:
              </label>
              <input
                className={inputCls}
                value={deleteInput}
                onChange={(e) => setDeleteInput(e.target.value)}
                placeholder={String(deleteTarget.match_number)}
                autoFocus
              />
            </div>

            <div className="flex gap-2 pt-1">
              <Btn tone="outline" className="flex-1 whitespace-nowrap text-xs md:text-sm" onClick={() => setDeleteTarget(null)}>Batal</Btn>
              <Btn
                tone="red"
                className="flex-1 font-black whitespace-nowrap text-xs md:text-sm px-3"
                icon={Trash2}
                disabled={deleteInput.trim() !== String(deleteTarget.match_number).trim()}
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
        <Modal title="Hapus SEMUA Pertandingan" onClose={() => setShowDeleteAllModal(false)} bodyClassName="p-4 md:p-5">
          <div className="space-y-3">
            <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-2xl text-rose-900 dark:text-rose-200 text-xs font-medium space-y-1">
              <div className="font-extrabold text-sm flex items-center gap-1.5 text-rose-700 dark:text-rose-400">
                <AlertTriangle className="w-4 h-4 shrink-0" /> Peringatan Permanen
              </div>
              <p>
                Tindakan ini akan menghapus <strong>SELURUH ({matches.length}) riwayat pertandingan</strong> secara permanen.
              </p>
            </div>

            <div>
              <label className="block text-xs font-extrabold opacity-80 mb-1">
                Ketik <strong className="text-rose-600 dark:text-rose-400 font-mono">"HAPUS SEMUA"</strong> untuk mengonfirmasi:
              </label>
              <input
                className={inputCls}
                value={deleteAllInput}
                onChange={(e) => setDeleteAllInput(e.target.value)}
                placeholder="HAPUS SEMUA"
                autoFocus
              />
            </div>

            <div className="flex gap-2 pt-1">
              <Btn tone="outline" className="flex-1 whitespace-nowrap text-xs md:text-sm" onClick={() => setShowDeleteAllModal(false)}>Batal</Btn>
              <Btn
                tone="red"
                className="flex-1 font-black whitespace-nowrap text-xs md:text-sm px-3"
                icon={Trash2}
                disabled={deleteAllInput.trim().toUpperCase() !== "HAPUS SEMUA"}
                onClick={handleConfirmDeleteAll}
              >
                HAPUS SEMUA
              </Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
