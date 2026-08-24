export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
export const nowIso = () => new Date().toISOString();
export const pad2 = (n) => String(n).padStart(2, "0");

export function fmtClock(sec) {
  const s = Math.max(0, Math.floor(sec));
  return `${pad2(Math.floor(s / 60))}:${pad2(s % 60)}`;
}

export function fmtDateTime(iso) {
  if (!iso) return "-";
  try {
    const d = new Date(iso);
    return d.toLocaleString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch (e) { return iso; }
}

export function slug(s) {
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

export function resultLabel(result) {
  switch (result) {
    case "benar": return "Benar";
    case "salah": return "Salah";
    case "waktu_habis": return "Waktu Habis";
    case "tidak_menjawab": return "Tidak Menjawab";
    default: return "-";
  }
}

export function winnersLabel(match) {
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

export function computeStats(match, questionEvents, buzzerEvents) {
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

  return { teamStats };
}

export function getDeletedMatchIds() {
  try {
    const raw = localStorage.getItem("deleted_match_ids");
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export function recordDeletedMatchId(id) {
  if (!id) return;
  try {
    const list = getDeletedMatchIds();
    if (!list.includes(id)) {
      list.push(id);
      localStorage.setItem("deleted_match_ids", JSON.stringify(list));
    }
  } catch (e) {}
}
