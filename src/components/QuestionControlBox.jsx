import React, { useEffect, useState } from "react";
import { Eye, EyeOff, Key, BookOpen, Edit3, Send } from "lucide-react";
import { Btn, Panel } from "./UI.jsx";
import { inputCls } from "../constants.js";
import { getWajibQnum, teamNameById } from "../utils/helpers.js";

export function QuestionControlBox({
  match,
  setMatch,
  questionEvents,
  answeringTeam,
  showQuestion,
  setShowQuestion,
  showAnswer,
  setShowAnswer,
  activeQuestionText,
  setActiveQuestionText,
  activeAnswerText,
  setActiveAnswerText,
  onOpenBankModal,
  isLight,
}) {
  const isWajib = match.round_type === "wajib";
  const isCadangan = match.round_type === "cadangan";
  const roundType = match.round_type || "rebutan";

  // Calculate current qnum
  const currentQnum = isWajib
    ? getWajibQnum(match, answeringTeam)
    : isCadangan
    ? match.cadangan_qnum || 1
    : match.rebutan_qnum || 1;

  // Auto-find question from match.questions Bank
  useEffect(() => {
    let qData = null;
    if (isWajib) {
      qData = match?.questions?.wajib?.[answeringTeam]?.[currentQnum - 1];
    } else if (isCadangan) {
      qData = match?.questions?.cadangan?.[currentQnum - 1];
    } else {
      qData = match?.questions?.rebutan?.[currentQnum - 1];
    }

    if (qData && qData.question) {
      setActiveQuestionText(qData.question);
      setActiveAnswerText(qData.answer || "");
    }
  }, [match?.questions, roundType, answeringTeam, currentQnum, isWajib, isCadangan, setActiveQuestionText, setActiveAnswerText]);

  const handleUpdateCurrentQuestion = (newText, newAns) => {
    setActiveQuestionText(newText);
    setActiveAnswerText(newAns);

    // Save back to match.questions
    setMatch((prev) => {
      if (!prev) return prev;
      const copy = JSON.parse(JSON.stringify(prev.questions || { wajib: {}, rebutan: [], cadangan: [] }));
      const idx = currentQnum - 1;
      if (isWajib) {
        if (!copy.wajib) copy.wajib = {};
        if (!copy.wajib[answeringTeam]) copy.wajib[answeringTeam] = [];
        copy.wajib[answeringTeam][idx] = { qnum: currentQnum, question: newText, answer: newAns };
      } else if (isCadangan) {
        if (!copy.cadangan) copy.cadangan = [];
        copy.cadangan[idx] = { qnum: currentQnum, question: newText, answer: newAns };
      } else {
        if (!copy.rebutan) copy.rebutan = [];
        copy.rebutan[idx] = { qnum: currentQnum, question: newText, answer: newAns };
      }
      return { ...prev, questions: copy };
    });
  };

  const currentTitle = isWajib
    ? `SOAL WAJIB TIM ${answeringTeam} (#${currentQnum})`
    : isCadangan
    ? `SOAL CADANGAN (#${currentQnum})`
    : `SOAL REBUTAN (#${currentQnum})`;

  return (
    <Panel className="p-5 md:p-6 space-y-4 border-2 border-blue-200 dark:border-slate-700 bg-gradient-to-br from-blue-50/50 via-white to-indigo-50/30 dark:from-slate-800/80 dark:to-slate-900/80 shadow-md">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="text-[10px] font-black uppercase tracking-widest text-[#2C3592] dark:text-amber-400 mb-0.5">
            PANEL KONTROL TAMPILAN SOAL PROYEKTOR (MANUAL)
          </div>
          <h3 className="text-base md:text-lg font-black uppercase tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <span>📜 {currentTitle}</span>
          </h3>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Btn tone="outline" size="sm" icon={BookOpen} onClick={onOpenBankModal}>
            Bank Soal
          </Btn>
        </div>
      </div>

      {/* Inputs for Active Question */}
      <div className="grid md:grid-cols-3 gap-3">
        <div className="md:col-span-2 space-y-1">
          <label className="block text-[11px] font-black uppercase opacity-75">Teks Pertanyaan Soal:</label>
          <textarea
            rows={2}
            className={`${inputCls} font-medium text-xs md:text-sm`}
            value={activeQuestionText}
            onChange={(e) => handleUpdateCurrentQuestion(e.target.value, activeAnswerText)}
            placeholder="Ketik teks pertanyaan soal di sini (atau kelola di Bank Soal)..."
          />
        </div>

        <div className="space-y-1">
          <label className="block text-[11px] font-black uppercase opacity-75">Kunci Jawaban:</label>
          <input
            className={`${inputCls} font-extrabold text-xs md:text-sm text-emerald-600 dark:text-emerald-400`}
            value={activeAnswerText}
            onChange={(e) => handleUpdateCurrentQuestion(activeQuestionText, e.target.value)}
            placeholder="Ketik kunci jawaban..."
          />
        </div>
      </div>

      {/* Proyektor Action Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200 dark:border-slate-700/80">
        <div className="flex items-center gap-2.5 flex-wrap">
          <Btn
            tone={showQuestion ? "emerald" : "amber"}
            size="md"
            icon={showQuestion ? EyeOff : Eye}
            className={`font-black shadow-lg transition-all scale-100 active:scale-95 ${
              showQuestion ? "ring-4 ring-emerald-400 animate-pulse" : ""
            }`}
            onClick={() => setShowQuestion((prev) => !prev)}
          >
            {showQuestion ? "🙈 SEMBUNYIKAN SOAL DI PROYEKTOR" : "👁️ TAMPILKAN SOAL DI PROYEKTOR"}
          </Btn>

          <Btn
            tone={showAnswer ? "blue" : "outline"}
            size="md"
            icon={Key}
            className={`font-black transition-all ${showAnswer ? "ring-2 ring-blue-400" : ""}`}
            onClick={() => setShowAnswer((prev) => !prev)}
          >
            {showAnswer ? "🔑 SEMBUNYIKAN KUNCI" : "🔑 TAMPILKAN KUNCI JAWABAN"}
          </Btn>
        </div>

        <div className="text-xs font-bold opacity-75 flex items-center gap-1.5">
          <span className={`inline-block w-2.5 h-2.5 rounded-full ${showQuestion ? "bg-emerald-500 animate-ping" : "bg-slate-400"}`} />
          <span>Status Proyektor: <strong>{showQuestion ? "MENAMPILKAN SOAL" : "SOAL DISEMBUNYIKAN"}</strong></span>
        </div>
      </div>
    </Panel>
  );
}
