import React, { useState } from "react";
import { BookOpen, Plus, Trash2, Save } from "lucide-react";
import { Modal, Btn, Field } from "./UI.jsx";
import { inputCls } from "../constants.js";
import { getMatchTeams } from "../utils/helpers.js";

export function QuestionBankModal({ match, setMatch, onClose }) {
  const teams = getMatchTeams(match);
  const [activeTab, setActiveTab] = useState("wajib");
  const [selectedWajibTeam, setSelectedWajibTeam] = useState(teams[0]?.id || "A");

  // Local state for editing questions
  const [questions, setQuestions] = useState(() => {
    return match?.questions || { wajib: {}, rebutan: [], cadangan: [] };
  });

  const handleSave = () => {
    setMatch((prev) => (prev ? { ...prev, questions } : prev));
    onClose();
  };

  // Helper getters/setters for question arrays
  const getQuestionsList = () => {
    if (activeTab === "wajib") {
      return questions?.wajib?.[selectedWajibTeam] || [];
    } else if (activeTab === "rebutan") {
      return questions?.rebutan || [];
    } else {
      return questions?.cadangan || [];
    }
  };

  const updateQuestionItem = (index, value) => {
    setQuestions((prev) => {
      const copy = JSON.parse(JSON.stringify(prev || { wajib: {}, rebutan: [], cadangan: [] }));
      if (activeTab === "wajib") {
        if (!copy.wajib) copy.wajib = {};
        if (!copy.wajib[selectedWajibTeam]) copy.wajib[selectedWajibTeam] = [];
        copy.wajib[selectedWajibTeam][index] = {
          ...copy.wajib[selectedWajibTeam][index],
          qnum: index + 1,
          question: value,
        };
      } else if (activeTab === "rebutan") {
        if (!copy.rebutan) copy.rebutan = [];
        copy.rebutan[index] = {
          ...copy.rebutan[index],
          qnum: index + 1,
          question: value,
        };
      } else {
        if (!copy.cadangan) copy.cadangan = [];
        copy.cadangan[index] = {
          ...copy.cadangan[index],
          qnum: index + 1,
          question: value,
        };
      }
      return copy;
    });
  };

  const addQuestionItem = () => {
    setQuestions((prev) => {
      const copy = JSON.parse(JSON.stringify(prev || { wajib: {}, rebutan: [], cadangan: [] }));
      if (activeTab === "wajib") {
        if (!copy.wajib) copy.wajib = {};
        if (!copy.wajib[selectedWajibTeam]) copy.wajib[selectedWajibTeam] = [];
        const nextQnum = copy.wajib[selectedWajibTeam].length + 1;
        copy.wajib[selectedWajibTeam].push({ qnum: nextQnum, question: "" });
      } else if (activeTab === "rebutan") {
        if (!copy.rebutan) copy.rebutan = [];
        const nextQnum = copy.rebutan.length + 1;
        copy.rebutan.push({ qnum: nextQnum, question: "" });
      } else {
        if (!copy.cadangan) copy.cadangan = [];
        const nextQnum = copy.cadangan.length + 1;
        copy.cadangan.push({ qnum: nextQnum, question: "" });
      }
      return copy;
    });
  };

  const deleteQuestionItem = (index) => {
    setQuestions((prev) => {
      const copy = JSON.parse(JSON.stringify(prev || { wajib: {}, rebutan: [], cadangan: [] }));
      if (activeTab === "wajib" && copy.wajib?.[selectedWajibTeam]) {
        copy.wajib[selectedWajibTeam].splice(index, 1);
        copy.wajib[selectedWajibTeam].forEach((q, i) => (q.qnum = i + 1));
      } else if (activeTab === "rebutan" && copy.rebutan) {
        copy.rebutan.splice(index, 1);
        copy.rebutan.forEach((q, i) => (q.qnum = i + 1));
      } else if (activeTab === "cadangan" && copy.cadangan) {
        copy.cadangan.splice(index, 1);
        copy.cadangan.forEach((q, i) => (q.qnum = i + 1));
      }
      return copy;
    });
  };

  const currentList = getQuestionsList();

  return (
    <Modal title="📚 Kelola Bank Soal Pertandingan" onClose={onClose} bodyClassName="p-5 max-w-4xl">
      <div className="space-y-5">
        {/* Top Control Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-100 dark:bg-slate-800/80 p-3 rounded-2xl border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <Btn
              tone={activeTab === "wajib" ? "blue" : "outline"}
              size="sm"
              onClick={() => setActiveTab("wajib")}
            >
              Soal Wajib
            </Btn>
            <Btn
              tone={activeTab === "rebutan" ? "amber" : "outline"}
              size="sm"
              onClick={() => setActiveTab("rebutan")}
            >
              Soal Rebutan
            </Btn>
            <Btn
              tone={activeTab === "cadangan" ? "red" : "outline"}
              size="sm"
              onClick={() => setActiveTab("cadangan")}
            >
              Soal Cadangan
            </Btn>
          </div>
        </div>

        {/* Sub-selector for Wajib Teams */}
        {activeTab === "wajib" && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-black uppercase opacity-75">PILIH TIM:</span>
            {teams.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedWajibTeam(t.id)}
                className={`px-3 py-1.5 rounded-xl font-black text-xs border transition-all ${
                  selectedWajibTeam === t.id
                    ? "bg-[#2C3592] text-white border-blue-600 shadow-md"
                    : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700"
                }`}
              >
                {t.name} (Tim {t.id})
              </button>
            ))}
          </div>
        )}

        {/* Questions List */}
        <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2">
          {currentList.length === 0 && (
            <div className="text-center py-8 opacity-60 text-xs font-medium border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl">
              Belum ada soal untuk {activeTab === "wajib" ? `Tim ${selectedWajibTeam}` : activeTab}. Klik "Tambah Soal Baru".
            </div>
          )}

          {currentList.map((q, idx) => (
            <div
              key={idx}
              className="p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm space-y-3 relative group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-black bg-blue-100 dark:bg-blue-950 text-[#2C3592] dark:text-blue-300 px-3 py-1 rounded-lg uppercase">
                  {activeTab === "wajib" ? `SOAL WAJIB TIM ${selectedWajibTeam} #${idx + 1}` : activeTab === "rebutan" ? `SOAL REBUTAN #${idx + 1}` : `SOAL CADANGAN #${idx + 1}`}
                </span>
                <button
                  onClick={() => deleteQuestionItem(idx)}
                  className="text-red-500 hover:text-red-700 p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/50 transition-colors"
                  title="Hapus Soal"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div>
                <Field label="Teks Pertanyaan Soal">
                  <textarea
                    rows={2}
                    className={inputCls}
                    value={q.question || ""}
                    onChange={(e) => updateQuestionItem(idx, e.target.value)}
                    placeholder="Ketik teks pertanyaan soal..."
                  />
                </Field>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom Actions */}
        <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-200 dark:border-slate-700">
          <Btn tone="outline" size="sm" icon={Plus} onClick={addQuestionItem}>
            Tambah Soal Baru
          </Btn>
          <div className="flex items-center gap-2">
            <Btn tone="outline" size="sm" onClick={onClose}>
              Batal
            </Btn>
            <Btn tone="amber" size="sm" icon={Save} onClick={handleSave}>
              SIMPAN BANK SOAL
            </Btn>
          </div>
        </div>
      </div>
    </Modal>
  );
}
