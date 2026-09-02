import React, { useState, useEffect, useCallback } from "react";
import {
  Play, Pause, RotateCcw, Volume2, VolumeX, Trophy, CheckCircle2, XCircle,
  Edit3, Check, Tv, Eye, EyeOff, Key, BookOpen, SkipForward
} from "lucide-react";
import { Btn, Panel, Modal, Field } from "../components/UI.jsx";
import { TeamCard } from "../components/TeamCard.jsx";
import { TimerBar } from "../components/TimerBar.jsx";
import { HistoryTable } from "../components/HistoryTable.jsx";
import { RoomCodeEntryView } from "./RoomCodeEntryView.jsx";
import { getColor, inputCls } from "../constants.js";
import {
  uid, nowIso, getMatchTeams, getWajibQnum, incrementWajibQnum,
  teamNameById, resultLabel
} from "../utils/helpers.js";
import { broadcastBuzzer } from "../lib/sync-engine.js";
import { QuestionBankModal } from "../components/QuestionBankModal.jsx";

export function ScoreboardView(props) {
  const {
    match, setMatch, questionEvents, setQuestionEvents, scoreLog, commitScore,
    timerDisplay, timerDuration, setTimerDuration, timerRunning,
    startTimer, pauseTimer, resetTimer,
    soundOn, setSoundOn, sounds,
    onFinishMatch, theme, onConnectRoom, roomId, triggerBuzzRef,
    onClearRoom, navigateTo, lockedOutTeams = [], setLockedOutTeams,
    buzzedTeam: propBuzzedTeam, setBuzzedTeam: propSetBuzzedTeam,
    showQuestion, setShowQuestion, showAnswer, setShowAnswer,
    activeQuestionText, setActiveQuestionText, activeAnswerText, setActiveAnswerText
  } = props;

  if (!match) {
    return <RoomCodeEntryView defaultCode={roomId} onConnectRoom={onConnectRoom} onClearRoom={onClearRoom} navigateTo={navigateTo} />;
  }

  const teams = getMatchTeams(match);
  const [localAnsweringTeam, setLocalAnsweringTeam] = useState(teams[0]?.id || "A");
  const answeringTeam = props.answeringTeam || localAnsweringTeam;
  const setAnsweringTeam = props.setAnsweringTeam || setLocalAnsweringTeam;
  const [currentEventId, setCurrentEventId] = useState(null);
  const [localBuzzedTeam, setLocalBuzzedTeam] = useState(null);
  const buzzedTeam = propBuzzedTeam !== undefined ? propBuzzedTeam : localBuzzedTeam;
  const setBuzzedTeam = propSetBuzzedTeam || setLocalBuzzedTeam;
  const [buzzerLocked, setBuzzerLocked] = useState(false);
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [correctTeamId, setCorrectTeamId] = useState(teams[0]?.id || "A");
  const [correctPoints, setCorrectPoints] = useState(100);
  const [correctReason, setCorrectReason] = useState("");

  const [showEditTitleModal, setShowEditTitleModal] = useState(false);
  const [editMatchName, setEditMatchName] = useState(match.match_name || "FINAL OLIMPIADE SAINS");
  const [editSubTitle, setEditSubTitle] = useState(match.sub_title || "UNIVERSITAS TERBUKA");
  const [showBankModal, setShowBankModal] = useState(false);

  const isWajib = match.round_type === "wajib";
  const isCadangan = match.round_type === "cadangan";
  const isRebutan = match.round_type === "rebutan" || (!isWajib && !isCadangan);
  const matchPaused = match.status === "paused";
  const isLight = theme === "light";

  // Calculate current qnum & auto-set activeQuestionText from match.questions
  const currentQnum = isWajib
    ? getWajibQnum(match, answeringTeam)
    : isCadangan
    ? match.cadangan_qnum || 1
    : match.rebutan_qnum || 1;

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
    } else {
      setActiveQuestionText("");
      setActiveAnswerText("");
    }
  }, [match?.questions, match?.round_type, answeringTeam, currentQnum, isWajib, isCadangan, setActiveQuestionText, setActiveAnswerText]);

  function handleSaveMatchTitle() {
    setMatch((prev) => (prev ? { ...prev, match_name: editMatchName, sub_title: editSubTitle } : prev));
    setShowEditTitleModal(false);
  }

  const maxScore = teams.length > 0 ? Math.max(...teams.map((t) => t.score || 0)) : 0;
  const topTeams = teams.filter((t) => (t.score || 0) === maxScore);
  const isTie = topTeams.length > 1;

  const wajibMax = match.wajib_max_qnum || 5;
  const rebutanMax = match.rebutan_max_qnum || 10;

  const currentTeamWajibCount = questionEvents.filter(
    (e) => e.round_type === "wajib" && e.answering_team === answeringTeam && e.result !== null
  ).length;

  const totalRebutanCount = questionEvents.filter(
    (e) => e.round_type === "rebutan" && e.result !== null
  ).length;

  const isWajibDoneForTeam = isWajib && currentTeamWajibCount >= wajibMax;
  const isRebutanDone = !isWajib && !isCadangan && totalRebutanCount >= rebutanMax;

  useEffect(() => {
    if (teams.length > 0 && !teams.some((t) => t.id === answeringTeam)) {
      setAnsweringTeam(teams[0].id);
    }
  }, [teams, answeringTeam]);

  const currentEvent = questionEvents.find((e) => e.id === currentEventId) || null;

  const triggerBuzz = useCallback((teamId) => {
    if (isWajib) return;
    const isCad = match.round_type === "cadangan";
    if (!isCad) {
      const totalRebutanCount = questionEvents.filter(
        (e) => e.round_type === "rebutan" && e.result !== null
      ).length;
      const rebutanMax = match.rebutan_max_qnum || 10;
      if (totalRebutanCount >= rebutanMax) {
        alert(`Babak Soal Rebutan sudah selesai (${rebutanMax}/${rebutanMax} soal)!`);
        return;
      }
    }
    if (buzzerLocked || buzzedTeam) return;
    if (lockedOutTeams.includes(teamId)) return;
    setBuzzedTeam(teamId);
    setBuzzerLocked(true);
    setAnsweringTeam(teamId);

    const teamIdx = teams.findIndex((t) => t.id === teamId);
    sounds.buzzTeam(teamIdx >= 0 ? teamIdx : 0);

    if (roomId) {
      broadcastBuzzer(roomId, teamId);
    }

    const currentRound = match.round_type === "cadangan" ? "cadangan" : "rebutan";
    const currentQnum = match.round_type === "cadangan" ? (match.cadangan_qnum || 1) : (match.rebutan_qnum || 1);
    const roundNote = match.round_type === "cadangan" ? "Soal Cadangan" : "Soal Rebutan";

    const ev = {
      id: uid(),
      match_id: match.id,
      round_type: currentRound,
      question_number: currentQnum,
      answering_team: teamId,
      result: null,
      points: 0,
      started_at: nowIso(),
      ended_at: null,
      timer_used: 0,
      note: roundNote,
    };
    setQuestionEvents((prev) => [...prev, ev]);
    setCurrentEventId(ev.id);
    startTimer(timerDuration, true);
  }, [isWajib, buzzerLocked, buzzedTeam, teams, sounds, roomId, match.id, match.round_type, match.rebutan_qnum, match.cadangan_qnum, match.rebutan_max_qnum, setQuestionEvents, startTimer, timerDuration, questionEvents, lockedOutTeams]);

  useEffect(() => {
    if (setLockedOutTeams) {
      setLockedOutTeams([]);
    }
  }, [match?.id, match?.round_type, match?.rebutan_qnum, match?.cadangan_qnum, setLockedOutTeams]);

  useEffect(() => {
    if (triggerBuzzRef) {
      triggerBuzzRef.current = triggerBuzz;
    }
  });

  const cancelBuzzer = useCallback(() => {
    pauseTimer();
    setBuzzedTeam(null);
    setBuzzerLocked(false);
    resetTimer(timerDuration);
  }, [pauseTimer, resetTimer, timerDuration]);

  /* ---------------- WAJIB ACTIONS ---------------- */

  function startWajibTimer() {
    if (!answeringTeam || timerRunning || matchPaused) return;
    const currentTeamWajibCount = questionEvents.filter(
      (e) => e.round_type === "wajib" && e.answering_team === answeringTeam && e.result !== null
    ).length;
    const wajibMax = match.wajib_max_qnum || 5;
    if (currentTeamWajibCount >= wajibMax) {
      alert(`Tim ${teamNameById(match, answeringTeam)} sudah menyelesaikan seluruh ${wajibMax} soal wajib!`);
      return;
    }
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
      startTimer(timerDuration, true);
    } else {
      startTimer(timerDuration);
    }
  }

  const resolveWajib = useCallback((result) => {
    const wajibMax = match.wajib_max_qnum || 5;
    const currentTeamWajibCount = questionEvents.filter(
      (e) => e.round_type === "wajib" && e.answering_team === answeringTeam && e.result !== null
    ).length;

    if (currentTeamWajibCount >= wajibMax) {
      alert(`Tim ${teamNameById(match, answeringTeam)} sudah menyelesaikan seluruh ${wajibMax} soal wajib!`);
      return;
    }

    pauseTimer();
    sounds[result === "benar" ? "correct" : "wrong"]();
    const pts = result === "benar" ? 100 : 0;
    const currentQnum = getWajibQnum(match, answeringTeam);

    if (currentEventId) {
      setQuestionEvents((prev) => prev.map((e) => e.id === currentEventId ? { ...e, result, points: pts, ended_at: nowIso(), timer_used: timerDuration - timerDisplay } : e));
    } else {
      const ev = {
        id: uid(),
        match_id: match.id,
        round_type: "wajib",
        question_number: currentQnum,
        answering_team: answeringTeam,
        result,
        points: pts,
        started_at: nowIso(),
        ended_at: nowIso(),
        timer_used: 0,
        note: `Soal Wajib Tim ${answeringTeam}`,
      };
      setQuestionEvents((prev) => [...prev, ev]);
    }

    commitScore(answeringTeam, pts, `Soal Wajib No. ${currentQnum} (${resultLabel(result)})`);

    setMatch((prev) => {
      if (!prev) return prev;
      return incrementWajibQnum(prev, answeringTeam);
    });

    setCurrentEventId(null);
    resetTimer(timerDuration);
  }, [pauseTimer, sounds, currentEventId, setQuestionEvents, timerDuration, timerDisplay, commitScore, answeringTeam, setMatch, resetTimer, questionEvents, match]);

  const resolveRebutan = useCallback((result) => {
    const isCad = match.round_type === "cadangan";
    if (!isCad) {
      const totalRebutanCount = questionEvents.filter(
        (e) => e.round_type === "rebutan" && e.result !== null
      ).length;
      const rebutanMax = match.rebutan_max_qnum || 10;
      if (totalRebutanCount >= rebutanMax) {
        alert(`Babak Soal Rebutan sudah menyelesaikan seluruh ${rebutanMax} soal!`);
        return;
      }
    }

    pauseTimer();
    sounds[result === "benar" ? "correct" : "wrong"]();
    const pts = result === "benar" ? 150 : -50;
    const targetTeam = buzzedTeam || answeringTeam;
    const roundLabelStr = isCad ? "Soal Cadangan" : "Soal Rebutan";
    const currentQnum = isCad ? (match.cadangan_qnum || 1) : (match.rebutan_qnum || 1);

    if (currentEventId) {
      setQuestionEvents((prev) => prev.map((e) => e.id === currentEventId ? { ...e, result, answering_team: targetTeam, points: pts, ended_at: nowIso(), timer_used: timerDuration - timerDisplay } : e));
    } else {
      const ev = {
        id: uid(),
        match_id: match.id,
        round_type: isCad ? "cadangan" : "rebutan",
        question_number: currentQnum,
        answering_team: targetTeam,
        result,
        points: pts,
        started_at: nowIso(),
        ended_at: nowIso(),
        timer_used: 0,
        note: roundLabelStr,
      };
      setQuestionEvents((prev) => [...prev, ev]);
    }

    commitScore(targetTeam, pts, `${roundLabelStr} No. ${currentQnum} (${resultLabel(result)})`);

    if (setLockedOutTeams) setLockedOutTeams([]);

    setMatch((prev) => {
      if (!prev) return prev;
      if (isCad) {
        return { ...prev, cadangan_qnum: (prev.cadangan_qnum || 1) + 1 };
      }
      const nextQ = (prev.rebutan_qnum || 1) + 1;
      return { ...prev, round_type: "rebutan", status: "rebutan", rebutan_qnum: nextQ };
    });
    setCurrentEventId(null);
    setBuzzedTeam(null);
    setBuzzerLocked(false);
    resetTimer(timerDuration);
  }, [pauseTimer, sounds, buzzedTeam, answeringTeam, currentEventId, setQuestionEvents, timerDuration, timerDisplay, commitScore, setMatch, resetTimer, match, questionEvents, setLockedOutTeams]);

  const resolveRebutanThrow = useCallback((mode = "salah") => {
    const isCad = match.round_type === "cadangan";
    pauseTimer();
    sounds.wrong();

    const targetTeam = buzzedTeam || answeringTeam;
    if (!targetTeam) return;

    const pts = mode === "tanpa_penalti" ? 0 : -50;
    const roundLabelStr = isCad ? "Soal Cadangan" : "Soal Rebutan";
    const currentQnum = isCad ? (match.cadangan_qnum || 1) : (match.rebutan_qnum || 1);
    const noteSuffix = mode === "tanpa_penalti" ? "(Batal/Lempar)" : "(Salah - Dilempar)";

    if (currentEventId) {
      setQuestionEvents((prev) => prev.map((e) => e.id === currentEventId ? { ...e, result: mode === "tanpa_penalti" ? "dilempar" : "salah", answering_team: targetTeam, points: pts, ended_at: nowIso(), timer_used: timerDuration - timerDisplay } : e));
    } else {
      const ev = {
        id: uid(),
        match_id: match.id,
        round_type: isCad ? "cadangan" : "rebutan",
        question_number: currentQnum,
        answering_team: targetTeam,
        result: mode === "tanpa_penalti" ? "dilempar" : "salah",
        points: pts,
        started_at: nowIso(),
        ended_at: nowIso(),
        timer_used: 0,
        note: `${roundLabelStr} ${noteSuffix}`,
      };
      setQuestionEvents((prev) => [...prev, ev]);
    }

    commitScore(targetTeam, pts, `${roundLabelStr} No. ${currentQnum} ${noteSuffix}`);

    if (setLockedOutTeams) {
      setLockedOutTeams((prev) => (prev.includes(targetTeam) ? prev : [...prev, targetTeam]));
    }

    setCurrentEventId(null);
    setBuzzedTeam(null);
    setBuzzerLocked(false);
    resetTimer(timerDuration);
  }, [pauseTimer, sounds, buzzedTeam, answeringTeam, currentEventId, setQuestionEvents, timerDuration, timerDisplay, commitScore, resetTimer, match, setLockedOutTeams]);

  const advanceToNextRebutanQuestion = useCallback(() => {
    pauseTimer();
    if (setLockedOutTeams) setLockedOutTeams([]);
    setMatch((prev) => {
      if (!prev) return prev;
      if (prev.round_type === "cadangan") {
        return { ...prev, cadangan_qnum: (prev.cadangan_qnum || 1) + 1 };
      }
      const nextQ = (prev.rebutan_qnum || 1) + 1;
      return { ...prev, round_type: "rebutan", status: "rebutan", rebutan_qnum: nextQ };
    });
    setCurrentEventId(null);
    setBuzzedTeam(null);
    setBuzzerLocked(false);
    resetTimer(timerDuration);
  }, [pauseTimer, setMatch, resetTimer, timerDuration, setLockedOutTeams]);

  const resolveRebutanTimeout = useCallback(() => {
    pauseTimer();
    sounds.wrong();
    if (setLockedOutTeams) setLockedOutTeams([]);
    if (currentEventId) {
      setQuestionEvents((prev) => prev.map((e) => e.id === currentEventId ? { ...e, result: "waktu_habis", points: 0, ended_at: nowIso() } : e));
    }
    setMatch((prev) => {
      if (!prev) return prev;
      if (prev.round_type === "cadangan") {
        return { ...prev, cadangan_qnum: (prev.cadangan_qnum || 1) + 1 };
      }
      const nextQ = (prev.rebutan_qnum || 1) + 1;
      return { ...prev, rebutan_qnum: nextQ };
    });
    setCurrentEventId(null);
    setBuzzedTeam(null);
    setBuzzerLocked(false);
    resetTimer(timerDuration);
  }, [pauseTimer, sounds, currentEventId, setQuestionEvents, setMatch, resetTimer, timerDuration, setLockedOutTeams]);

  /* ---------------- KEYBOARD SHORTCUTS LISTENER ---------------- */
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (["INPUT", "TEXTAREA", "SELECT"].includes(e.target?.tagName)) return;

      const key = e.key.toLowerCase();

      if (e.code === "Space") {
        e.preventDefault();
        if (timerRunning) pauseTimer();
        else {
          if (isWajib) startWajibTimer();
          else startTimer(timerDuration);
        }
        return;
      }

      if (e.code === "Escape") {
        e.preventDefault();
        cancelBuzzer();
        return;
      }

      if (!isWajib && !buzzedTeam && !buzzerLocked && !isRebutanDone) {
        if (key === "s") {
          e.preventDefault();
          advanceToNextRebutanQuestion();
          return;
        }

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

      if ((isWajib && !isWajibDoneForTeam) || (buzzedTeam && !isRebutanDone)) {
        if (key === "y" || e.code === "Enter") {
          e.preventDefault();
          if (isWajib) resolveWajib("benar");
          else resolveRebutan("benar");
        } else if (key === "n" || e.code === "Backspace") {
          e.preventDefault();
          if (isWajib) resolveWajib("salah");
          else resolveRebutanThrow("salah");
        } else if (key === "l") {
          e.preventDefault();
          if (!isWajib) resolveRebutanThrow("tanpa_penalti");
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isWajib, isWajibDoneForTeam, isRebutanDone, buzzedTeam, buzzerLocked, timerRunning, teams, answeringTeam, currentEventId, timerDuration, pauseTimer, startTimer, cancelBuzzer, triggerBuzz, resolveWajib, resolveRebutan, resolveRebutanThrow]);

  useEffect(() => {
    props.setTimeUpHandler(() => () => {
      if (isWajib) {
        if (currentEventId) resolveWajib("waktu_habis");
      } else {
        if (currentEventId && !buzzedTeam) resolveRebutanTimeout();
      }
    });
  }, [isWajib, currentEventId, buzzedTeam, questionEvents, props, resolveWajib, resolveRebutanTimeout]);

  function handleManualScoreCorrection() {
    if (!correctTeamId) return;
    const pts = parseInt(correctPoints, 10);
    if (isNaN(pts)) {
      alert("Masukkan jumlah perubahan poin (+/-) yang valid, contoh: 100 atau -50");
      return;
    }
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
        <div className="flex items-center gap-2.5 flex-wrap">
          <Btn
            tone="blue"
            size="sm"
            icon={Tv}
            onClick={() => window.open(`/projector?room=${roomId || match?.room_code || ""}&match=${match.id}`, "_blank")}
          >
            Layar Besar (Proyektor)
          </Btn>
          <Btn
            tone={showQuestion ? "emerald" : "outline"}
            size="sm"
            icon={showQuestion ? EyeOff : Eye}
            className={showQuestion ? "animate-pulse" : ""}
            onClick={() => setShowQuestion((prev) => !prev)}
          >
            {showQuestion ? "Soal Tayang" : "Tampilkan Soal"}
          </Btn>
          <Btn tone="outline" size="sm" icon={BookOpen} onClick={() => setShowBankModal(true)}>
            Bank Soal
          </Btn>
          <Btn tone="outline" size="sm" icon={Edit3} onClick={() => {
            setEditMatchName(match.match_name || "FINAL OLIMPIADE SAINS");
            setEditSubTitle(match.sub_title || "UNIVERSITAS TERBUKA");
            setShowEditTitleModal(true);
          }}>
            Edit Judul Proyektor
          </Btn>
          <Btn tone="outline" size="sm" icon={Edit3} onClick={() => { setCorrectTeamId(answeringTeam || teams[0]?.id || "A"); setShowCorrectionModal(true); }}>
            Koreksi Poin
          </Btn>
          <button
            onClick={() => setSoundOn(!soundOn)}
            className={`p-2 rounded-xl border shadow-sm transition-all ${isLight ? "bg-[#FFE600] text-[#2C3592] border-amber-300" : "bg-slate-800 text-emerald-400 border-slate-700 hover:bg-slate-700"}`}
            title="Efek Suara"
          >
            {soundOn ? <Volume2 className="w-4 h-4 text-[#2C3592] dark:text-emerald-400" /> : <VolumeX className="w-4 h-4 text-red-600 dark:text-red-400" />}
          </button>
          <Btn tone="amber" size="sm" icon={Trophy} onClick={onFinishMatch}>
            Selesaikan Pertandingan
          </Btn>
        </div>
      </div>

      {/* Active Match Title Banner */}
      <div className={`p-4 rounded-2xl border flex items-center justify-between gap-4 flex-wrap shadow-sm ${isLight ? "bg-gradient-to-r from-blue-50/80 to-indigo-50/80 border-blue-200 text-[#2C3592]" : "bg-slate-800/80 border-slate-700 text-slate-100"}`}>
        <div>
          <div className="text-[10px] font-black uppercase tracking-wider opacity-70 mb-0.5">JUDUL & LOKASI PROYEKTOR (ROOM {roomId})</div>
          <h2 className="text-base md:text-xl font-black tracking-tight uppercase">{match.match_name || "FINAL OLIMPIADE SAINS"}</h2>
          <p className="text-xs font-bold opacity-80 uppercase tracking-widest mt-0.5">{match.sub_title || "UNIVERSITAS TERBUKA"}</p>
        </div>
        <Btn tone="amber" size="sm" icon={Edit3} onClick={() => {
          setEditMatchName(match.match_name || "FINAL OLIMPIADE SAINS");
          setEditSubTitle(match.sub_title || "UNIVERSITAS TERBUKA");
          setShowEditTitleModal(true);
        }}>
          Ubah Judul Proyektor
        </Btn>
      </div>

      {/* Round Switcher & Question Count Banner */}
      <Panel className="p-5 flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4 flex-wrap">
          <span className="text-xs font-black uppercase tracking-wider opacity-70">BABAK AKTIF:</span>
          <div className={`inline-flex rounded-xl p-1 border flex-wrap gap-1 ${isLight ? "bg-slate-100 border-slate-200" : "bg-slate-800/80 border-slate-700"}`}>
            <button
              onClick={() => setMatch((m) => (m ? { ...m, round_type: "wajib", status: "wajib" } : m))}
              className={`px-4 py-2 rounded-lg font-black text-xs md:text-sm transition-all ${isWajib ? "bg-[#2C3592] text-white shadow-md" : isLight ? "text-slate-600 hover:text-slate-900" : "opacity-70 hover:opacity-100"}`}
            >
              SOAL WAJIB ({match.wajib_max_qnum || 5} SOAL/TIM)
            </button>
            <button
              onClick={() => setMatch((m) => (m ? { ...m, round_type: "rebutan", status: "rebutan" } : m))}
              className={`px-4 py-2 rounded-lg font-black text-xs md:text-sm transition-all ${isRebutan ? "bg-red-600 text-white shadow-md" : isLight ? "text-slate-600 hover:text-slate-900" : "opacity-70 hover:opacity-100"}`}
            >
              SOAL REBUTAN ({match.rebutan_max_qnum || 10} SOAL)
            </button>
            <button
              onClick={() => setMatch((m) => (m ? { ...m, round_type: "cadangan", status: "cadangan" } : m))}
              className={`px-4 py-2 rounded-lg font-black text-xs md:text-sm transition-all ${isCadangan ? "bg-amber-500 text-slate-950 shadow-md" : isLight ? "text-slate-600 hover:text-slate-900" : "opacity-70 hover:opacity-100"}`}
            >
              SOAL CADANGAN (SERI)
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Target Soal Setting */}
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/90 px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 shadow-sm text-xs">
            <span className="font-extrabold uppercase opacity-75">Max Soal Wajib:</span>
            <input
              type="number"
              min="1"
              max="50"
              className="w-12 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-1.5 py-0.5 text-center font-mono-num font-black text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#2C3592]"
              value={match.wajib_max_qnum || 5}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val) && val > 0) {
                  setMatch((m) => m ? { ...m, wajib_max_qnum: val } : m);
                }
              }}
            />
            <span className="font-extrabold uppercase opacity-75 ml-2">Rebutan:</span>
            <input
              type="number"
              min="1"
              max="100"
              className="w-12 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-1.5 py-0.5 text-center font-mono-num font-black text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#2C3592]"
              value={match.rebutan_max_qnum || 10}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val) && val > 0) {
                  setMatch((m) => m ? { ...m, rebutan_max_qnum: val } : m);
                }
              }}
            />
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
            isLockedOut={lockedOutTeams.includes(t.id)}
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
            <TimerBar seconds={timerDisplay} duration={timerDuration} running={timerRunning} theme={theme} />
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
                    PENILAIAN SOAL WAJIB ({teamNameById(match, answeringTeam).toUpperCase()}) — {isWajibDoneForTeam ? `SOAL SELESAI (${wajibMax}/${wajibMax})` : `SOAL KE-${Math.min(getWajibQnum(match, answeringTeam), wajibMax)} DARI ${wajibMax}`}
                  </div>
                  {activeQuestionText ? (
                    <div className="text-xs font-medium opacity-90 flex items-center justify-between gap-2 mt-1.5 p-2 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="font-bold text-[#2C3592] dark:text-amber-400 shrink-0">📜 Soal:</span>
                        <span className="truncate italic">"{activeQuestionText}"</span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => setShowQuestion((prev) => !prev)}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition-all flex items-center gap-1 ${
                            showQuestion
                              ? "bg-emerald-600 text-white shadow-sm animate-pulse"
                              : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300"
                          }`}
                        >
                          {showQuestion ? "🙈 SEMBUNYIKAN SOAL" : "👁️ TAMPILKAN SOAL"}
                        </button>
                        <button
                          onClick={() => setShowBankModal(true)}
                          className="px-2 py-1 rounded-lg text-[10px] font-black bg-blue-50 dark:bg-slate-700 text-blue-700 dark:text-blue-300 hover:bg-blue-100"
                          title="Edit Soal"
                        >
                          ✏️ Edit
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs opacity-70 font-medium">Jalankan waktu di sebelah kiri, kemudian tentukan hasil jawaban tim.</p>
                  )}
                </div>

                {isWajibDoneForTeam ? (
                  <div className="p-4 bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-300 dark:border-emerald-700 rounded-2xl text-emerald-900 dark:text-emerald-200 text-center space-y-2 shadow-sm">
                    <div className="text-sm font-black flex items-center justify-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span>{teamNameById(match, answeringTeam).toUpperCase()} SUDAH MENJAWAB SEMUA {wajibMax} SOAL WAJIB!</span>
                    </div>
                    <p className="text-xs opacity-80 font-medium">
                      Pilih tim lain di atas untuk menilai soal wajib mereka, atau klik <strong>SOAL REBUTAN</strong> di atas jika semua tim sudah selesai.
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3.5">
                    <Btn tone="emerald" size="lg" icon={CheckCircle2} onClick={() => resolveWajib("benar")}>
                      JAWABAN BENAR (+100 POIN) <span className="text-xs opacity-75 font-mono ml-1">[Enter / Y]</span>
                    </Btn>
                    <Btn tone="red" size="lg" icon={XCircle} onClick={() => resolveWajib("salah")}>
                      JAWABAN SALAH (0 POIN) <span className="text-xs opacity-75 font-mono ml-1">[Backspace / N]</span>
                    </Btn>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-5">
                <div className="text-sm font-black text-red-600 dark:text-red-400 uppercase tracking-wider">
                  {isCadangan
                    ? `PENILAIAN SOAL CADANGAN (+150 / -50) — SOAL KE-${(match.cadangan_qnum || 1)}`
                    : `PENILAIAN SOAL REBUTAN (+150 / -50) — SOAL KE-${Math.min(match.rebutan_qnum || 1, rebutanMax)} DARI ${rebutanMax}`}
                </div>

                {isRebutanDone ? (
                  <div className="p-4 bg-amber-50 dark:bg-amber-950/70 border border-amber-300 dark:border-amber-700 rounded-2xl text-amber-900 dark:text-amber-200 text-center space-y-2 shadow-sm">
                    <div className="text-sm font-black flex items-center justify-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
                      <span>BABAK SOAL REBUTAN SELESAI ({rebutanMax}/{rebutanMax} SOAL)!</span>
                    </div>
                    <p className="text-xs opacity-80 font-medium">
                      Silakan klik <strong>"Selesaikan Pertandingan"</strong> di atas, atau aktifkan <strong>"SOAL CADANGAN"</strong> jika perolehan poin tim bernilai SERI.
                    </p>
                  </div>
                ) : !buzzedTeam ? (
                  <div className="space-y-4">
                    {lockedOutTeams.length > 0 && (
                      <div className="p-3.5 bg-amber-500/15 border border-amber-500/30 rounded-xl space-y-1.5 text-xs">
                        <div className="font-black text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                          📢 SOAL DILEMPAR KEPADA TIM LAIN!
                        </div>
                        <div className="opacity-90 font-medium">
                          Tim yang sudah dikunci pada nomor ini: <strong className="font-bold">{lockedOutTeams.map((id) => teamNameById(match, id)).join(", ")}</strong>. Tim lain masih bisa menekan bel.
                        </div>
                      </div>
                    )}

                    <div>
                      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                        <label className="text-xs font-extrabold uppercase tracking-wider opacity-70">
                          PILIH TIM YANG MENEKAN BEL TERCEPAT:
                        </label>
                        <Btn tone="amber" size="sm" className="text-xs font-black" icon={SkipForward} onClick={advanceToNextRebutanQuestion}>
                          Lanjut Soal (Soal Hangus) <span className="text-[10px] opacity-75 font-mono ml-1">[S]</span>
                        </Btn>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        {teams.map((t, idx) => {
                          const colorInfo = getColor(t.color);
                          const keyLabel = idx === 0 ? "1 / A" : idx === 1 ? "2 / B" : idx === 2 ? "3 / C" : idx === 3 ? "4 / D" : idx === 4 ? "5 / E" : idx === 5 ? "6 / F" : idx === 6 ? "7 / G" : "8 / H";
                          const isLocked = lockedOutTeams.includes(t.id);
                          if (isLocked) {
                            return (
                              <button
                                key={t.id}
                                disabled
                                className="p-3.5 rounded-xl font-black text-xs border bg-slate-200 dark:bg-slate-800/60 text-slate-400 dark:text-slate-500 cursor-not-allowed flex items-center justify-between gap-2 opacity-60"
                                title="Tim ini sudah menjawab salah pada nomor soal ini"
                              >
                                <span className="flex items-center gap-1.5">🔒 BEL {t.name} (TERKUNCI)</span>
                                <span className="text-[10px] px-2 py-0.5 rounded-md bg-black/10 dark:bg-white/10 font-mono font-bold uppercase">[🔒]</span>
                              </button>
                            );
                          }
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
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      <Btn tone="red" size="md" className="w-full" icon={XCircle} onClick={() => resolveRebutanThrow("salah")}>
                        SALAH & LEMPAR (-50) <span className="text-xs opacity-75 font-mono ml-1">[N / Backspace]</span>
                      </Btn>
                      <Btn tone="amber" size="md" className="w-full" icon={XCircle} onClick={() => resolveRebutan("salah")}>
                        SALAH & SELESAI (-50)
                      </Btn>
                    </div>
                    <Btn tone="outline" size="sm" className="w-full text-xs" icon={RotateCcw} onClick={() => resolveRebutanThrow("tanpa_penalti")}>
                      LEMPAR TANPA PENALTI (0 POIN) <span className="text-xs opacity-75 font-mono ml-1">[L]</span>
                    </Btn>
                    <Btn tone="outline" size="sm" className="w-full text-xs opacity-75" icon={RotateCcw} onClick={cancelBuzzer}>
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

      {/* Edit Match Title Modal */}
      {showEditTitleModal && (
        <Modal title="Edit Info Match & Judul Proyektor" onClose={() => setShowEditTitleModal(false)}>
          <div className="space-y-4">
            <Field label="Judul Utama Proyektor / Pertandingan">
              <input
                className={inputCls}
                value={editMatchName}
                onChange={(e) => setEditMatchName(e.target.value)}
                placeholder="misal: FINAL OLIMPIADE SAINS BIOLOGI"
              />
            </Field>
            <Field label="Sub-Judul Instansi / Lokasi Proyektor">
              <input
                className={inputCls}
                value={editSubTitle}
                onChange={(e) => setEditSubTitle(e.target.value)}
                placeholder="misal: UNIVERSITAS TERBUKA BANDUNG"
              />
            </Field>
            <div className="flex gap-3 pt-2">
              <Btn tone="outline" className="flex-1" onClick={() => setShowEditTitleModal(false)}>Batal</Btn>
              <Btn tone="amber" className="flex-1" icon={Check} onClick={handleSaveMatchTitle}>SIMPAN JUDUL</Btn>
            </div>
          </div>
        </Modal>
      )}
      {/* Question Bank Modal */}
      {showBankModal && (
        <QuestionBankModal
          match={match}
          setMatch={setMatch}
          onClose={() => setShowBankModal(false)}
        />
      )}
    </div>
  );
}
