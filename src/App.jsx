import React, { useState, useEffect, useRef, useCallback } from "react";
import * as XLSX from "xlsx";
import {
  Radio, Check, Copy
} from "lucide-react";
import {
  generateRoomId, initSyncEngine, broadcastState, broadcastBuzzer, broadcastGlobalMatchesIndex
} from "./lib/sync-engine.js";
import { setActiveSyncRoom } from "./lib/storage-shim.js";
import { useSoundEngine } from "./hooks/useSoundEngine.js";
import { HeaderNav, Modal, Btn, Field, LogoUT } from "./components/UI.jsx";
import { getMatchTeams, uid, nowIso, getDeletedMatchIds, recordDeletedMatchId } from "./utils/helpers.js";

import { SetupView, getNextMatchNumber } from "./views/SetupView.jsx";
import { MatchListView } from "./views/MatchListView.jsx";
import { ProjectorView } from "./views/ProjectorView.jsx";
import { BuzzerPlayerView } from "./views/BuzzerPlayerView.jsx";
import { RecapView } from "./views/RecapView.jsx";
import { RulesView } from "./views/RulesView.jsx";
import { ScoreboardView } from "./views/ScoreboardView.jsx";
import { inputCls } from "./constants.js";

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
  const pathname = window.location.pathname.toLowerCase();
  const searchParams = new URLSearchParams(window.location.search);
  const roomParam = searchParams.get("id") || searchParams.get("room") || null;
  const matchParam = searchParams.get("match") || null;

  let view = "dashboard";
  if (pathname.includes("/setup")) view = "setup";
  else if (pathname.includes("/matches")) view = "matches";
  else if (pathname.includes("/projector")) view = "projector";
  else if (pathname.includes("/recap")) view = "recap";
  else if (pathname.includes("/rules")) view = "rules";
  else if (pathname.includes("/buzzer")) view = "buzzer";

  return { view, roomParam, matchParam };
}

/* ============================== EXCEL EXPORT FUNCTION ============================== */

function exportMatchExcel(match, questionEvents, scoreLog, buzzerEvents) {
  if (!match) return;
  const teams = getMatchTeams(match);

  const summaryData = teams.map((t, idx) => ({
    "Peringkat": idx + 1,
    "Nama Tim": t.name,
    "Instansi / Sekolah": t.school || "-",
    "Skor Akhir": t.score,
  }));

  const eventsData = questionEvents.map((e, idx) => ({
    "No": idx + 1,
    "Waktu": e.started_at ? new Date(e.started_at).toLocaleTimeString() : "-",
    "Babak": e.round_type === "wajib" ? "Soal Wajib" : "Soal Rebutan",
    "No. Soal": e.question_number,
    "Tim Menjawab": e.answering_team ? `Tim ${e.answering_team}` : "-",
    "Hasil": e.result === "benar" ? "Benar (+100/+150)" : e.result === "salah" ? "Salah/Penalti (-50/0)" : e.result === "waktu_habis" ? "Waktu Habis" : "-",
    "Poin Ditambahkan": e.points,
  }));

  const wb = XLSX.utils.book_new();
  const wsSummary = XLSX.utils.json_to_sheet(summaryData);
  const wsEvents = XLSX.utils.json_to_sheet(eventsData);

  XLSX.utils.book_append_sheet(wb, wsSummary, "Ringkasan Hasil");
  XLSX.utils.book_append_sheet(wb, wsEvents, "Detail Pertanyaan");

  XLSX.writeFile(wb, `Rekap_Olimpiade_Match_${match.match_number || "1"}_${match.date || "2026"}.xlsx`);
}

export function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "light");

  const [viewState, setViewState] = useState(() => parseLocation());

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
  const [lockedOutTeams, setLockedOutTeams] = useState([]);
  const [buzzedTeam, setBuzzedTeam] = useState(null);

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
  const isRemoteMatchesSyncRef = useRef(false);
  const triggerBuzzRef = useRef(null);

  /* ---------------- TIMER LOGIC ---------------- */
  const lastSecondSoundRef = useRef(-1);

  useEffect(() => {
    let iv = null;
    if (timerRunning) {
      const updateTimer = () => {
        if (timerStartedAt) {
          const elapsed = Math.floor((Date.now() - timerStartedAt) / 1000);
          const remaining = Math.max(0, (timerDuration || 45) - elapsed);
          setTimerDisplay(remaining);

          if (remaining !== lastSecondSoundRef.current) {
            lastSecondSoundRef.current = remaining;
            if (remaining <= 0) {
              setTimerRunning(false);
              setTimerStartedAt(null);
              if (soundsRef.current) soundsRef.current.timeUp();
              if (timeUpHandlerRef.current) timeUpHandlerRef.current()();
            } else if (remaining <= 5 && soundsRef.current) {
              soundsRef.current.tenLeft();
            }
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
      };

      updateTimer();
      iv = setInterval(updateTimer, 250);
    } else {
      lastSecondSoundRef.current = -1;
    }
    return () => {
      if (iv) clearInterval(iv);
    };
  }, [timerRunning, timerStartedAt, timerDuration]);

  /* Tab focus / visibility change handler to prevent background tab timer freeze */
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && timerRunning && timerStartedAt) {
        const elapsed = Math.floor((Date.now() - timerStartedAt) / 1000);
        const remaining = Math.max(0, (timerDuration || 45) - elapsed);
        setTimerDisplay(remaining);
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [timerRunning, timerStartedAt, timerDuration]);

  const startTimer = (d, forceReset = false) => {
    const now = Date.now();
    lastLocalUpdateRef.current = now;
    const dur = typeof d === "number" && d > 0 ? d : (timerDuration || 45);
    setTimerDuration(dur);

    let remaining = timerDisplay;
    if (forceReset || typeof remaining !== "number" || remaining <= 0 || remaining > dur) {
      remaining = dur;
      setTimerDisplay(dur);
    }

    const elapsedMs = (dur - remaining) * 1000;
    setTimerStartedAt(now - elapsedMs);
    setTimerRunning(true);
    if (soundsRef.current) soundsRef.current.timerStart();
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
      if (soundsRef.current) soundsRef.current.buzzTeam(msg.teamId);
      if (triggerBuzzRef.current) {
        triggerBuzzRef.current(msg.teamId);
      }
      return;
    }

    if (msg.timestamp && lastLocalUpdateRef.current && msg.timestamp < lastLocalUpdateRef.current - 500) {
      return;
    }

    if (msg.type === "GLOBAL_MATCHES_INDEX" && Array.isArray(msg.payload)) {
      if (Array.isArray(msg.deletedIds)) {
        msg.deletedIds.forEach((id) => recordDeletedMatchId(id));
      }

      const deletedIds = getDeletedMatchIds();
      const incomingList = msg.payload.filter((m) => m && m.id && !deletedIds.includes(m.id));

      setMatches((prevList) => {
        // Purge locally cached match files for any matches marked deleted
        prevList.forEach((m) => {
          if (m && m.id && deletedIds.includes(m.id)) {
            window.storage.delete(`match:${m.id}`, false).catch(() => {});
            localStorage.removeItem(`olimpiade2026:personal:match:${m.id}`);
          }
        });

        // Ignore empty incoming index if we already have local matches
        if (incomingList.length === 0 && prevList.length > 0) {
          return prevList;
        }

        const nextList = incomingList;

        if (JSON.stringify(nextList) === JSON.stringify(prevList)) {
          return prevList;
        }

        isRemoteMatchesSyncRef.current = true;
        try {
          window.storage.set("matches-index", JSON.stringify(nextList), false).catch(() => {});
          localStorage.setItem("olimpiade2026:personal:matches-index", JSON.stringify(nextList));
        } catch (e) {}

        return nextList;
      });
      return;
    }

    if (msg.type === "SYNC_STATE" && msg.payload) {
      const deletedIds = getDeletedMatchIds();
      const data = msg.payload;
      if (data.match && data.match.id) {
        if (deletedIds.includes(data.match.id)) return;
        isRemoteSyncRef.current = true;
        setMatch(data.match);
        setMatches((prevList) => {
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
          const idx = prevList.findIndex((x) => x.id === data.match.id);
          let next;
          if (idx === -1) {
            next = [entry, ...prevList];
          } else {
            next = [...prevList];
            next[idx] = entry;
          }
          try {
            window.storage.set("matches-index", JSON.stringify(next), false).catch(() => {});
            localStorage.setItem("olimpiade2026:personal:matches-index", JSON.stringify(next));
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
      if (data.questionEvents) {
        setQuestionEvents(data.questionEvents);
      } else if (data.match && data.match.question_events) {
        setQuestionEvents(data.match.question_events);
      }
      if (data.scoreLog && Array.isArray(data.scoreLog)) {
        setScoreLog(data.scoreLog);
      } else if (data.match && Array.isArray(data.match.score_log)) {
        setScoreLog(data.match.score_log);
      }
      if (data.buzzerEvents) setBuzzerEvents(data.buzzerEvents);
      if (Array.isArray(data.lockedOutTeams)) setLockedOutTeams(data.lockedOutTeams);
      if (data.buzzedTeam !== undefined) setBuzzedTeam(data.buzzedTeam);
      if (typeof data.timerRunning === "boolean") setTimerRunning(data.timerRunning);
      if (typeof data.timerDuration === "number") setTimerDuration(data.timerDuration);
      if (data.timerStartedAt !== undefined) {
        setTimerStartedAt(data.timerStartedAt);
        if (data.timerRunning && data.timerStartedAt) {
          const elapsed = Math.floor((Date.now() - data.timerStartedAt) / 1000);
          const remaining = Math.max(0, (data.timerDuration || 45) - elapsed);
          setTimerDisplay(remaining);
        }
      }
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

  /* Initial load of matches index from storage/localStorage */
  useEffect(() => {
    async function loadMatchesIndex() {
      const deletedIds = getDeletedMatchIds();
      let list = [];
      try {
        const res = await window.storage.get("matches-index");
        if (res && res.value) {
          list = JSON.parse(res.value);
        } else {
          const rawLocal = localStorage.getItem("olimpiade2026:personal:matches-index");
          if (rawLocal) {
            list = JSON.parse(rawLocal);
          }
        }
      } catch (e) {}

      const filtered = list.filter((m) => m && m.id && !deletedIds.includes(m.id));
      if (filtered.length > 0) {
        setMatches(filtered);
      }
    }
    loadMatchesIndex();
  }, []);

  /* Broadcast matches index globally whenever matches list updates */
  useEffect(() => {
    if (isRemoteMatchesSyncRef.current) {
      isRemoteMatchesSyncRef.current = false;
      return;
    }
    if (matches && matches.length > 0) {
      broadcastGlobalMatchesIndex(matches, getDeletedMatchIds());
    }
  }, [matches]);

  /* Real-time broadcast via MQTT */
  useEffect(() => {
    if (isRemoteSyncRef.current) {
      isRemoteSyncRef.current = false;
      return;
    }
    // Only Operator view (dashboard / room) should broadcast state updates!
    const currentView = viewState.view;
    if (currentView !== "dashboard" && currentView !== "room") return;
    if (!match || !roomId) return;

    broadcastState(roomId, {
      match,
      questionEvents,
      scoreLog,
      buzzerEvents,
      lockedOutTeams,
      buzzedTeam,
      timerRunning,
      timerDisplay,
      timerDuration,
      timerStartedAt,
    });
  }, [match, questionEvents, scoreLog, buzzerEvents, lockedOutTeams, buzzedTeam, timerRunning, timerDuration, timerStartedAt, roomId, viewState.view]);

  /* Auto load match by roomId if user navigates to /room?id=XYZ without match param */
  const loadedRoomMatchRef = useRef(null);
  useEffect(() => {
    if (!match && roomId && matches.length > 0 && loadedRoomMatchRef.current !== roomId) {
      const matchForRoom = matches.find((m) => m.room_code === roomId || m.roomCode === roomId);
      if (matchForRoom) {
        loadedRoomMatchRef.current = roomId;
        openMatch(matchForRoom.id, false);
      }
    }
  }, [roomId, matches, match]);

  /* Load specific match if URL has match parameter */
  const loadedMatchParamRef = useRef(null);
  useEffect(() => {
    if (viewState.matchParam && loadedMatchParamRef.current !== viewState.matchParam) {
      loadedMatchParamRef.current = viewState.matchParam;
      openMatch(viewState.matchParam, false);
    }
  }, [viewState.matchParam]);

  /* Storage: Persist match */
  const saveTimeout = useRef(null);
  useEffect(() => {
    if (!match) return;
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(async () => {
      try {
        const payloadData = { match: { ...match, question_events: questionEvents }, questionEvents, scoreLog, buzzerEvents };
        await window.storage.set(`match:${match.id}`, JSON.stringify(payloadData), false);
        localStorage.setItem(`olimpiade2026:personal:match:${match.id}`, JSON.stringify(payloadData));

        setMatches((prevList) => {
          const entry = {
            id: match.id,
            match_number: match.match_number,
            match_name: match.match_name,
            date: match.date,
            teams: getMatchTeams(match),
            status: match.status,
            winner: match.winner,
            room_code: match.room_code || roomId,
          };
          const idx = prevList.findIndex((x) => x.id === match.id);
          let next;
          if (idx === -1) {
            next = [entry, ...prevList];
          } else {
            if (JSON.stringify(prevList[idx]) === JSON.stringify(entry)) {
              return prevList;
            }
            next = [...prevList];
            next[idx] = entry;
          }
          window.storage.set("matches-index", JSON.stringify(next), false).catch(() => { });
          localStorage.setItem("olimpiade2026:personal:matches-index", JSON.stringify(next));
          return next;
        });
      } catch (e) { console.error("Gagal menyimpan data pertandingan", e); }
    }, 350);
  }, [match, questionEvents, scoreLog, buzzerEvents, roomId]);

  /* Scoring helpers */
  function commitScore(teamId, points, eventLabel) {
    if (!match) return;
    lastLocalUpdateRef.current = Date.now();
    const teams = getMatchTeams(match);
    const teamObj = teams.find((t) => t.id === teamId);
    const before = teamObj ? (typeof teamObj.score === "number" ? teamObj.score : 0) : 0;
    const after = before + points;

    const logEntry = {
      id: uid(),
      match_id: match.id,
      team: teamId,
      event: eventLabel,
      points_change: points,
      score_before: before,
      score_after: after,
      operator: match.operator || "-",
      timestamp: nowIso(),
    };

    setMatch((prev) => {
      if (!prev) return prev;
      const prevTeams = getMatchTeams(prev);
      const idx = prevTeams.findIndex((t) => t.id === teamId);
      if (idx === -1) return prev;

      const pBefore = typeof prevTeams[idx].score === "number" ? prevTeams[idx].score : 0;
      const pAfter = pBefore + points;

      const updatedTeams = [...prevTeams];
      updatedTeams[idx] = { ...updatedTeams[idx], score: pAfter };

      const existingLogs = Array.isArray(prev.score_log) ? prev.score_log : [];
      return {
        ...prev,
        teams: updatedTeams,
        score_log: [...existingLogs, logEntry],
      };
    });

    setScoreLog((prevLog) => [...prevLog, logEntry]);
  }

  /* Match lifecycle */
  function startNewMatch(form) {
    const newRoom = generateRoomId();
    connectToRoom(newRoom);

    if (form.match_name) {
      try { localStorage.setItem("app_event_title", form.match_name); } catch (e) { }
    }
    if (form.sub_title) {
      try { localStorage.setItem("app_sub_title", form.sub_title); } catch (e) { }
    }

    const m = {
      id: uid(),
      room_code: newRoom,
      match_number: form.match_number || getNextMatchNumber(matches),
      match_name: form.match_name || localStorage.getItem("app_event_title") || "Final Olimpiade Sains",
      sub_title: form.sub_title || localStorage.getItem("app_sub_title") || "UNIVERSITAS TERBUKA",
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
      cadangan_qnum: 1,
      wajib_max_qnum: parseInt(form.wajib_max_qnum, 10) || 5,
      rebutan_max_qnum: parseInt(form.rebutan_max_qnum, 10) || 10,
      timer_duration: 45,
      created_at: nowIso(),
      finished_at: null,
    };

    const entry = {
      id: m.id,
      match_number: m.match_number,
      match_name: m.match_name,
      date: m.date,
      teams: getMatchTeams(m),
      status: m.status,
      winner: m.winner,
      room_code: m.room_code,
    };

    setMatches((prev) => {
      const next = [entry, ...prev.filter((x) => x.id !== m.id)];
      try {
        window.storage.set("matches-index", JSON.stringify(next), false).catch(() => {});
        localStorage.setItem("olimpiade2026:personal:matches-index", JSON.stringify(next));
      } catch (e) {}
      return next;
    });

    setMatch(m);
    setQuestionEvents([]);
    setScoreLog([]);
    setBuzzerEvents([]);
    setTimerDuration(45);
    resetTimer(45);

    try {
      const initPayload = { match: m, questionEvents: [], scoreLog: [], buzzerEvents: [] };
      window.storage.set(`match:${m.id}`, JSON.stringify(initPayload), false).catch(() => {});
      localStorage.setItem(`olimpiade2026:personal:match:${m.id}`, JSON.stringify(initPayload));
    } catch (e) {}

    navigateTo("/room", { id: newRoom, match: m.id });
  }

  async function openMatch(id, doNavigate = true) {
    if (!id) return;
    try {
      let data = null;
      const res = await window.storage.get(`match:${id}`);
      if (res && res.value) {
        data = JSON.parse(res.value);
      } else {
        const localRaw = localStorage.getItem(`olimpiade2026:personal:match:${id}`);
        if (localRaw) {
          data = JSON.parse(localRaw);
        }
      }

      if (!data && matches.length > 0) {
        const found = matches.find((m) => m.id === id);
        if (found) {
          data = {
            match: found,
            questionEvents: [],
            scoreLog: found.score_log || [],
            buzzerEvents: [],
          };
        }
      }

      if (data && data.match) {
        let matchCode = data.match.room_code || data.match.code || roomId;
        if (!matchCode || !/^[A-Z]{3}-\d{4}$/.test(matchCode)) {
          matchCode = generateRoomId();
          data.match.room_code = matchCode;
          window.storage.set(`match:${id}`, JSON.stringify(data), false).catch(() => { });
        }

        connectToRoom(matchCode);
        setMatch(data.match);
        setQuestionEvents(data.questionEvents || data.match?.question_events || []);
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
    } catch (e) { console.error("Gagal memuat data pertandingan.", e); }
  }

  async function deleteMatch(matchId) {
    recordDeletedMatchId(matchId);

    try {
      await window.storage.delete(`match:${matchId}`, false);
      localStorage.removeItem(`olimpiade2026:personal:match:${matchId}`);
    } catch (e) { }

    setMatches((prev) => {
      const deletedIds = getDeletedMatchIds();
      const next = prev.filter((m) => m.id !== matchId && !deletedIds.includes(m.id));
      try {
        window.storage.set("matches-index", JSON.stringify(next), false).catch(() => { });
        localStorage.setItem("olimpiade2026:personal:matches-index", JSON.stringify(next));
      } catch (e) {}
      broadcastGlobalMatchesIndex(next, deletedIds);
      return next;
    });

    if (match && match.id === matchId) {
      setMatch(null);
      setQuestionEvents([]);
      setScoreLog([]);
      setBuzzerEvents([]);
      setRoomId(null);
      try { localStorage.removeItem("active_room"); } catch (e) {}
      if (typeof window !== "undefined" && window.history && window.history.pushState) {
        window.history.pushState({}, "", "/matches");
        setViewState(parseLocation());
      }
    }
  }

  async function deleteAllMatches() {
    matches.forEach((m) => recordDeletedMatchId(m.id));
    const deletedIds = getDeletedMatchIds();

    try {
      for (const m of matches) {
        await window.storage.delete(`match:${m.id}`, false);
        localStorage.removeItem(`olimpiade2026:personal:match:${m.id}`);
      }
      await window.storage.set("matches-index", "[]", false);
      localStorage.setItem("olimpiade2026:personal:matches-index", "[]");
    } catch (e) { }

    setMatches([]);
    broadcastGlobalMatchesIndex([], deletedIds);
    setMatch(null);
    setQuestionEvents([]);
    setScoreLog([]);
    setBuzzerEvents([]);
    setRoomId(null);
    try { localStorage.removeItem("active_room"); } catch (e) {}
    if (typeof window !== "undefined" && window.history && window.history.pushState) {
      window.history.pushState({}, "", "/matches");
      setViewState(parseLocation());
    }
  }

  function finishMatch() {
    setMatch((prev) => {
      if (!prev) return prev;
      const teams = getMatchTeams(prev);
      const getScore = (t) => (typeof t.score === "number" ? t.score : 0);
      const maxScore = Math.max(...teams.map(getScore));
      const topTeams = teams.filter((t) => getScore(t) === maxScore);
      const winner = topTeams.length === 1 ? topTeams[0].id : "SERI";
      return { ...prev, status: "finished", winner, finished_at: nowIso() };
    });
    navigateTo("/recap", { id: match?.id || "" });
  }

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
        lockedOutTeams={lockedOutTeams}
        buzzedTeam={buzzedTeam}
        onExit={() => navigateTo("/room", { id: roomId })}
        theme={theme}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col transition-colors">
      <HeaderNav
        currentView={currentView}
        match={match}
        roomId={roomId}
        syncStatus={syncStatus}
        theme={theme}
        toggleTheme={toggleTheme}
        navigateTo={navigateTo}
        setShowRoomModal={setShowRoomModal}
        setJoinRoomInput={setJoinRoomInput}
      />

      <main className="flex-1">
        {currentView === "setup" && (
          <SetupView
            matches={matches}
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
            lockedOutTeams={lockedOutTeams}
          />
        )}

        {(currentView === "dashboard" || currentView === "room") && (
          <ScoreboardView
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
            lockedOutTeams={lockedOutTeams}
            setLockedOutTeams={setLockedOutTeams}
            buzzedTeam={buzzedTeam}
            setBuzzedTeam={setBuzzedTeam}
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
            navigateTo={navigateTo}
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
        <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
          <LogoUT className="h-16 w-auto mb-4 bg-white p-2 rounded-2xl shadow-md border border-slate-200" />
          <h2 className="text-2xl font-black mb-2">Terjadi Kesalahan Aplikasi</h2>
          <p className="opacity-75 text-sm max-w-md mb-6 font-medium">
            {this.state.error?.message || "Terjadi kendala saat memuat data."}
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="px-5 py-2.5 bg-[#2C3592] hover:bg-[#1E256C] text-white font-bold rounded-xl shadow-md transition-all text-sm"
            >
              Muat Ulang Halaman
            </button>
            <button
              onClick={() => {
                localStorage.clear();
                window.location.href = "/matches";
              }}
              className="px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl shadow-md transition-all text-sm"
            >
              Reset Data & Buka Daftar
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export function RootApp(props) {
  return (
    <ErrorBoundary>
      <App {...props} />
    </ErrorBoundary>
  );
}

export default RootApp;


