import React from "react";
import {
  Sun, Moon, Tv, Layers, BookOpen, Settings2, Radio, Copy, Check, Swords, ListChecks
} from "lucide-react";

export function LogoUT({ className = "w-10 h-10" }) {
  return (
    <img
      src="/logo-ut.png?v=2"
      alt="Logo Universitas Terbuka"
      className={`object-contain shrink-0 ${className}`}
    />
  );
}

export function Btn({ children, onClick, disabled, tone = "slate", size = "md", className = "", icon: Icon }) {
  const tones = {
    slate: "bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300 shadow-sm dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-100 dark:border-slate-700 font-bold",
    blue: "bg-[#2C3592] hover:bg-[#1E256C] text-white border-[#1E256C] shadow-sm font-black",
    red: "bg-red-600 hover:bg-red-500 text-white border-red-500 shadow-sm font-black disabled:bg-rose-200 disabled:text-rose-500 dark:disabled:bg-rose-950/40 dark:disabled:text-rose-600 disabled:border-transparent",
    emerald: "bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500 shadow-sm font-black",
    amber: "bg-[#FFE600] hover:bg-amber-300 text-[#2C3592] border-amber-300 font-black shadow-md",
    purple: "bg-purple-600 hover:bg-purple-500 text-white border-purple-500 shadow-sm font-black",
    outline: "bg-white hover:bg-slate-100 text-slate-800 border-slate-300 shadow-sm font-bold dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-100 dark:border-slate-700",
    ghost: "bg-transparent hover:bg-slate-200/50 dark:hover:bg-slate-800/30 text-slate-700 dark:text-slate-300 border-transparent",
  };
  const sizes = {
    sm: "px-3.5 py-1.5 text-xs rounded-lg",
    md: "px-4 py-2.5 text-sm rounded-xl",
    lg: "px-6 py-3.5 text-base rounded-xl",
    xl: "px-8 py-4.5 text-lg rounded-2xl",
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 border tracking-wide transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 ${tones[tone]} ${sizes[size]} ${className}`}
    >
      {Icon ? <Icon className="w-4 h-4 shrink-0" /> : null}
      {children}
    </button>
  );
}

export function Panel({ children, className = "" }) {
  return <div className={`glass-panel rounded-2xl shadow-lg ${className}`}>{children}</div>;
}

export function Modal({ title, children, onClose, bodyClassName = "p-6" }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
      <div className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-3xl w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-2xl border border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-lg font-black tracking-tight">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-2xl leading-none px-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">×</button>
        </div>
        <div className={bodyClassName}>{children}</div>
      </div>
    </div>
  );
}

export function Field({ label, children, className = "block mb-3" }) {
  return (
    <label className={className}>
      <span className="block text-xs font-extrabold uppercase tracking-wider opacity-80 mb-1">{label}</span>
      {children}
    </label>
  );
}

export function HeaderNav({
  currentView,
  match,
  roomId,
  syncStatus,
  theme,
  toggleTheme,
  navigateTo,
  setShowRoomModal,
  setJoinRoomInput
}) {
  const [copiedLink, setCopiedLink] = React.useState(false);
  const isLight = theme === "light";

  const copyLiveLink = () => {
    if (!roomId) return;
    const url = `${window.location.origin}/room?id=${roomId}${match ? `&match=${match.id}` : ""}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <header className={`border-b sticky top-0 z-40 px-2.5 md:px-6 py-2 shadow-md transition-colors ${isLight ? "bg-white text-slate-900 border-slate-200" : "bg-[#2C3592] text-white border-[#1E256C]"}`}>
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-1.5 md:gap-3 flex-nowrap">
        {/* Left Brand */}
        <div className="flex items-center gap-2 shrink-0 cursor-pointer whitespace-nowrap" onClick={() => navigateTo("/room", { id: roomId })}>
          <LogoUT className="h-8 md:h-9 w-auto shrink-0 bg-white p-0.5 rounded-lg shadow-sm border border-amber-300" />
          <div className="whitespace-nowrap flex flex-col justify-center">
            <div className={`font-black text-xs md:text-sm tracking-tight leading-tight ${isLight ? "text-[#2C3592]" : "text-white"}`}>
              UNIVERSITAS TERBUKA
            </div>
            <div className={`text-[10px] md:text-xs font-black tracking-wider uppercase ${isLight ? "text-amber-600" : "text-[#FFE600]"}`}>
              OLIMPIADE SAINS
            </div>
          </div>
        </div>

        {/* Center Navigation Tabs */}
        <nav className="flex items-center gap-1 md:gap-1.5 shrink-0 whitespace-nowrap overflow-x-auto no-scrollbar">
          <button
            onClick={() => navigateTo("/room", { id: roomId })}
            className={`px-2 py-1.5 md:px-2.5 md:py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 ${currentView === "dashboard" || currentView === "room" ? "bg-[#FFE600] text-[#2C3592] shadow-sm" : isLight ? "text-slate-700 hover:bg-slate-100" : "text-slate-200 hover:bg-[#1E256C]"}`}
          >
            <Swords className="w-3.5 h-3.5" /> <span className="hidden sm:inline whitespace-nowrap">Ruang Tanding</span>
          </button>
          <button
            onClick={() => navigateTo("/setup")}
            className={`px-2 py-1.5 md:px-2.5 md:py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 ${currentView === "setup" ? "bg-[#FFE600] text-[#2C3592] shadow-sm" : isLight ? "text-slate-700 hover:bg-slate-100" : "text-slate-200 hover:bg-[#1E256C]"}`}
          >
            <Settings2 className="w-3.5 h-3.5" /> <span className="hidden sm:inline whitespace-nowrap">Pengaturan</span>
          </button>
          <button
            onClick={() => navigateTo("/matches")}
            className={`px-2 py-1.5 md:px-2.5 md:py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 ${currentView === "matches" ? "bg-[#FFE600] text-[#2C3592] shadow-sm" : isLight ? "text-slate-700 hover:bg-slate-100" : "text-slate-200 hover:bg-[#1E256C]"}`}
          >
            <ListChecks className="w-3.5 h-3.5" /> <span className="hidden sm:inline whitespace-nowrap">Daftar Pertandingan</span>
          </button>
          <button
            onClick={() => navigateTo("/rules")}
            className={`px-2 py-1.5 md:px-2.5 md:py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 ${currentView === "rules" ? "bg-[#FFE600] text-[#2C3592] shadow-sm" : isLight ? "text-slate-700 hover:bg-slate-100" : "text-slate-200 hover:bg-[#1E256C]"}`}
          >
            <BookOpen className="w-3.5 h-3.5" /> <span className="hidden sm:inline whitespace-nowrap">Peraturan</span>
          </button>
          <button
            onClick={() => navigateTo("/buzzer", { room: roomId })}
            className={`px-2 py-1.5 md:px-2.5 md:py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 ${currentView === "buzzer" ? "bg-[#FFE600] text-[#2C3592] shadow-sm" : isLight ? "text-slate-700 hover:bg-slate-100" : "text-slate-200 hover:bg-[#1E256C]"}`}
          >
            <Radio className="w-3.5 h-3.5 text-red-500" /> <span className="hidden sm:inline whitespace-nowrap">Bel Peserta</span>
          </button>
        </nav>

        {/* Right Actions & Room Badge */}
        <div className="flex items-center gap-1 shrink-0 whitespace-nowrap">
          {roomId && (match || currentView === "room" || currentView === "dashboard" || currentView === "buzzer") ? (
            <div className="flex items-center gap-1 whitespace-nowrap shrink-0">
              <button
                onClick={copyLiveLink}
                className={`flex items-center gap-1 border rounded-xl px-2 py-1.5 text-xs font-black shadow-sm transition-all hover:scale-105 whitespace-nowrap shrink-0 ${isLight ? "bg-[#FFE600] text-[#2C3592] border-amber-400" : "bg-[#1E256C] text-white border-[#3E47A8]"}`}
                title="Klik untuk menyalin tautan pertandingan langsung"
              >
                <span className={`w-2 h-2 rounded-full ${syncStatus === "connected" ? "bg-emerald-600 dark:bg-emerald-400 animate-pulse" : "bg-amber-600"}`} />
                <span className="whitespace-nowrap">Room: <strong className="font-mono-num text-xs tracking-wider">{roomId}</strong></span>
                {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5 opacity-80" />}
              </button>
              <button
                onClick={() => {
                  setJoinRoomInput(roomId || "");
                  setShowRoomModal(true);
                }}
                className={`flex items-center gap-1 text-xs font-black border rounded-xl px-2 py-1.5 shadow-sm transition-all whitespace-nowrap shrink-0 ${isLight ? "bg-white text-slate-800 border-slate-300 hover:bg-slate-100" : "bg-[#1E256C] text-slate-100 border-[#3E47A8] hover:bg-[#252E80]"}`}
                title="Ubah / Pindah Kode Room"
              >
                <Radio className="w-3.5 h-3.5 text-amber-500" /> <span className="hidden sm:inline whitespace-nowrap">PINDAH ROOM</span>
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                setJoinRoomInput("");
                setShowRoomModal(true);
              }}
              className="flex items-center gap-1 text-xs font-black bg-[#FFE600] text-[#2C3592] border border-amber-300 rounded-xl px-2 py-1.5 hover:bg-amber-300 shadow-sm transition-all whitespace-nowrap shrink-0"
            >
              <Radio className="w-3.5 h-3.5" /> <span className="hidden sm:inline whitespace-nowrap">KODE ROOM</span>
            </button>
          )}

          <button
            onClick={toggleTheme}
            className={`p-1.5 rounded-xl border shadow-sm transition-all shrink-0 ${isLight ? "bg-white text-slate-800 border-slate-300 hover:bg-slate-50" : "bg-[#1E256C] text-[#FFE600] border-[#3E47A8] hover:bg-[#252E80]"}`}
            title="Ubah Mode Tampilan (Terang/Gelap)"
          >
            {isLight ? <Moon className="w-4 h-4 text-slate-800" /> : <Sun className="w-4 h-4 text-[#FFE600]" />}
          </button>
        </div>
      </div>
    </header>
  );
}
