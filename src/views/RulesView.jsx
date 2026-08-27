import React, { useState } from "react";
import { ArrowLeft, Edit3, RotateCcw, Plus, Trash2, Check } from "lucide-react";
import { Btn, Panel, Modal, Field } from "../components/UI.jsx";
import { inputCls } from "../constants.js";

const DEFAULT_RULES = {
  title: "PERATURAN FINAL OLIMPIADE SAINS",
  subTitle: "UNIVERSITAS TERBUKA",
  eventTitle: "FINAL OLIMPIADE SAINS",
  wajibTitle: "A. SOAL WAJIB (+100)",
  wajibItems: [
    "Setiap tim akan mendapatkan satu amplop soal yang berjumlah 5 soal.",
    "Waktu menjawab soal akan diberikan waktu selama 45 detik.",
    "Sistem penilaian menggunakan sistem Pinalti, artinya setiap pertanyaan harus dijawab benar. Jika jawaban dianggap tidak sempurna maka jawaban dinyatakan salah.",
    "Setiap pertanyaan yang dijawab benar mendapatkan penambahan nilai 100 poin. Jika jawaban dianggap tidak sempurna maka tim tersebut tidak mendapatkan nilai.",
    "Soal dijawab oleh tim yang bersangkutan, setelah selesai soal dibacakan.",
    "Official/pendamping tim tidak diperkenankan protes, kecuali ada soal atau jawaban yang benar-benar meragukan.",
    "Penonton dilarang membantu finalis menjawab pertanyaan dalam bentuk atau cara apa pun. Apabila diketahui ada pihak yang membantu finalis menjawab pertanyaan, nilai yang diperoleh akan dibatalkan dengan kesepakatan dewan juri.",
    "Keputusan dewan juri tidak dapat diganggu gugat."
  ],
  rebutanTitle: "B. SOAL REBUTAN (+150 / -50)",
  rebutanItems: [
    "Untuk setiap putaran, soal rebutan berjumlah 10 soal.",
    "Waktu menjawab soal akan diberikan waktu selama 45 detik.",
    "Semua peserta dari masing-masing tim boleh memberikan jawaban.",
    "Jawaban benar mendapatkan penambahan nilai 150 poin dan jawaban salah mendapatkan pengurangan nilai 50 poin.",
    "Jika jawaban dinyatakan tidak sempurna/salah, tim yang bersangkutan mendapatkan pengurangan nilai 50 poin dan kesempatan menjawab dilempar kepada tim-tim lainnya yang belum menjawab pada nomor soal tersebut.",
    "Tim yang telah menjawab salah pada suatu nomor soal akan dikunci (tidak dapat menekan bel lagi) hingga nomor soal berikutnya.",
    "Jika ada peserta yang menekan bel namun sama sekali tidak memberikan jawaban, tim yang bersangkutan mendapatkan pengurangan nilai 50 poin dan soal dilempar.",
    "Jawaban akan diberikan kepada tim yang lebih dahulu menekan bel.",
    "Jika soal sedang dibacakan dan salah satu tim menekan bel, maka pembacaan soal dihentikan kemudian tim yang menekan bel dipersilahkan untuk memberikan jawabannya.",
    "Official/pendamping regu tidak diperkenankan protes, kecuali ada soal atau jawaban yang benar-benar meragukan.",
    "Penonton dilarang membantu peserta menjawab pertanyaan dalam bentuk atau cara apa pun. Apabila diketahui ada pihak yang membantu peserta menjawab pertanyaan, nilai yang diperoleh akan dibatalkan dengan kesepakatan dewan juri.",
    "Keputusan dewan juri tidak dapat diganggu gugat."
  ],
  cadanganTitle: "C. SOAL CADANGAN / PENENTUAN PEMENANG (+150 / -50)",
  cadanganItems: [
    "Jika pada akhir babak rebutan terdapat dua atau lebih tim yang memperoleh nilai tertinggi sama (seri), maka akan dilaksanakan babak soal cadangan.",
    "Sistem penilaian babak soal cadangan menggunakan aturan soal rebutan (+150 poin untuk jawaban benar, -50 poin untuk jawaban salah/tidak menjawab).",
    "Tim yang berhasil mendapatkan akumulasi poin tertinggi pada akhir soal cadangan ditetapkan sebagai pemenang."
  ]
};

export function RulesView({ onBack, match }) {
  const [rules, setRules] = useState(() => {
    try {
      const saved = localStorage.getItem("custom_rules_v2");
      return saved ? JSON.parse(saved) : DEFAULT_RULES;
    } catch (e) {
      return DEFAULT_RULES;
    }
  });

  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState(rules);

  const matchTitle = editForm.eventTitle || rules.eventTitle || match?.match_name || localStorage.getItem("app_event_title") || "FINAL OLIMPIADE SAINS";

  const handleSaveRules = () => {
    setRules(editForm);
    try {
      localStorage.setItem("custom_rules_v2", JSON.stringify(editForm));
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
      localStorage.removeItem("custom_rules_v2");
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
          {(localStorage.getItem("custom_rules_v2") || localStorage.getItem("custom_rules")) && (
            <Btn tone="outline" icon={RotateCcw} onClick={handleResetDefault}>
              Reset Standar
            </Btn>
          )}
        </div>
      </div>

      <div className="mb-6">
        <h1 className="text-3xl font-black text-[#2C3592] dark:text-[#FFE600] tracking-tight">{rules.title || "PERATURAN FINAL OLIMPIADE SAINS TAHUN 2026"}</h1>
        <p className="opacity-80 text-sm font-extrabold uppercase mt-1 tracking-wider">{rules.subTitle || "UNIVERSITAS TERBUKA"} — {matchTitle}</p>
      </div>

      <div className="space-y-6">
        <Panel className="p-6 md:p-8">
          <h2 className="text-xl font-black text-[#2C3592] dark:text-blue-400 mb-4 tracking-tight border-b pb-2 border-slate-200 dark:border-slate-800">
            {rules.wajibTitle}
          </h2>
          <ol className="list-decimal list-inside space-y-3 text-sm leading-relaxed opacity-95 font-medium">
            {rules.wajibItems.map((item, idx) => (
              <li key={idx} className="pl-1">
                <span className="font-normal">{item}</span>
              </li>
            ))}
          </ol>
        </Panel>

        <Panel className="p-6 md:p-8">
          <h2 className="text-xl font-black text-red-700 dark:text-red-400 mb-4 tracking-tight border-b pb-2 border-slate-200 dark:border-slate-800">
            {rules.rebutanTitle}
          </h2>
          <ol className="list-decimal list-inside space-y-3 text-sm leading-relaxed opacity-95 font-medium">
            {rules.rebutanItems.map((item, idx) => (
              <li key={idx} className="pl-1">
                <span className="font-normal">{item}</span>
              </li>
            ))}
          </ol>
        </Panel>

        {rules.cadanganItems && (
          <Panel className="p-6 md:p-8">
            <h2 className="text-xl font-black text-amber-600 dark:text-amber-400 mb-4 tracking-tight border-b pb-2 border-slate-200 dark:border-slate-800">
              {rules.cadanganTitle || "C. SOAL CADANGAN / PENENTUAN PEMENANG (+150 / -50)"}
            </h2>
            <ol className="list-decimal list-inside space-y-3 text-sm leading-relaxed opacity-95 font-medium">
              {rules.cadanganItems.map((item, idx) => (
                <li key={idx} className="pl-1">
                  <span className="font-normal">{item}</span>
                </li>
              ))}
            </ol>
          </Panel>
        )}
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
