import React, { useState, useEffect } from "react";
import { Play, ArrowLeft, AlertTriangle } from "lucide-react";
import { Btn, Panel, Field } from "../components/UI.jsx";
import { TEAM_COLORS, getColor, inputCls } from "../constants.js";

export function getNextMatchNumber(matchesList = []) {
  if (!Array.isArray(matchesList) || matchesList.length === 0) return "01";

  const used = new Set(
    matchesList
      .map((m) => m && m.match_number ? parseInt(String(m.match_number).replace(/\D/g, ""), 10) : null)
      .filter((n) => typeof n === "number" && !isNaN(n) && n > 0)
  );

  let next = 1;
  while (used.has(next)) {
    next++;
  }
  return String(next).padStart(2, "0");
}

export function SetupView({ matches = [], onStart, onCancel, showCancel, theme }) {
  const [teamCount, setTeamCount] = useState(2);
  const [form, setForm] = useState(() => ({
    match_name: (typeof window !== "undefined" && localStorage.getItem("app_event_title")) || "FINAL OLIMPIADE SAINS",
    sub_title: (typeof window !== "undefined" && localStorage.getItem("app_sub_title")) || "UNIVERSITAS TERBUKA",
    match_number: getNextMatchNumber(matches),
    wajib_max_qnum: 5,
    rebutan_max_qnum: 10,
    operator: "",
    juri: "",
    date: new Date().toISOString().slice(0, 10),
  }));

  const [isNumberUserEdited, setIsNumberUserEdited] = useState(false);

  useEffect(() => {
    if (!isNumberUserEdited) {
      setForm((prev) => ({
        ...prev,
        match_number: getNextMatchNumber(matches),
      }));
    }
  }, [matches, isNumberUserEdited]);

  const isNumberUsed = (matches || []).some((m) => {
    if (!m || m.match_number === undefined || m.match_number === null) return false;
    const existingStr = String(m.match_number).trim();
    const currentStr = String(form.match_number).trim();
    if (!existingStr || !currentStr) return false;

    const existingNum = parseInt(existingStr.replace(/\D/g, ""), 10);
    const currentNum = parseInt(currentStr.replace(/\D/g, ""), 10);
    if (!isNaN(existingNum) && !isNaN(currentNum)) {
      return existingNum === currentNum;
    }
    return existingStr.toLowerCase() === currentStr.toLowerCase();
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
          score: 0,
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

  const handleFormChange = (k) => (e) => {
    if (k === "match_number") setIsNumberUserEdited(true);
    setForm((f) => ({ ...f, [k]: e.target.value }));
  };

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
          <Field label="Judul Utama Proyektor / Pertandingan">
            <input className={inputCls} value={form.match_name} onChange={handleFormChange("match_name")} placeholder="FINAL OLIMPIADE SAINS" />
          </Field>
          <Field label="Sub-Judul Instansi / Lokasi Proyektor">
            <input className={inputCls} value={form.sub_title} onChange={handleFormChange("sub_title")} placeholder="UNIVERSITAS TERBUKA BANDUNG" />
          </Field>
          <Field label="Nomor Pertandingan">
            <input
              className={`${inputCls} ${isNumberUsed ? "border-rose-500 dark:border-rose-500 focus:ring-rose-500" : ""}`}
              value={form.match_number}
              onChange={handleFormChange("match_number")}
              placeholder="01"
            />
            {isNumberUsed && (
              <p className="text-xs text-rose-600 dark:text-rose-400 font-extrabold mt-1.5 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                Nomor pertandingan ini ({form.match_number}) sudah digunakan! Harap pakai nomor lain (contoh: {getNextMatchNumber(matches)}).
              </p>
            )}
          </Field>
          <Field label="Tanggal Pertandingan">
            <input type="date" className={inputCls} value={form.date} onChange={handleFormChange("date")} />
          </Field>
          <Field label="Jumlah Soal Wajib (per Tim)">
            <input type="number" min="1" max="50" className={inputCls} value={form.wajib_max_qnum} onChange={handleFormChange("wajib_max_qnum")} placeholder="5" />
          </Field>
          <Field label="Jumlah Soal Rebutan (Total)">
            <input type="number" min="1" max="100" className={inputCls} value={form.rebutan_max_qnum} onChange={handleFormChange("rebutan_max_qnum")} placeholder="10" />
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
          <Btn
            tone="amber"
            size="lg"
            className="flex-1 font-black"
            icon={Play}
            disabled={isNumberUsed || !String(form.match_number).trim()}
            onClick={() => onStart({ ...form, teams })}
          >
            MULAI PERTANDINGAN ({teamCount} TIM)
          </Btn>
        </div>
      </Panel>
    </div>
  );
}
