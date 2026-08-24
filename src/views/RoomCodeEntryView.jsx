import React, { useState, useEffect } from "react";
import { Swords, ListChecks, PlusCircle } from "lucide-react";
import { Btn, Panel, Field } from "../components/UI.jsx";
import { inputCls } from "../constants.js";

export function RoomCodeEntryView({ defaultCode, onConnectRoom, onClearRoom, navigateTo }) {
  const [code, setCode] = useState(defaultCode || "");

  useEffect(() => {
    if (defaultCode) setCode(defaultCode);
  }, [defaultCode]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (code.trim()) {
      onConnectRoom(code.trim().toUpperCase());
    }
  };

  return (
    <div className="w-full flex-1 flex flex-col items-center justify-center py-4 px-4 max-w-md mx-auto min-h-[50vh]">
      <Panel className="w-full p-4 md:p-5 space-y-3 shadow-xl text-center">
        <div className="flex flex-col items-center">
          <h2 className="text-xl md:text-2xl font-black tracking-tight">Masuk Room Lomba</h2>
          <p className="opacity-80 text-xs mt-1 max-w-xs mx-auto font-medium">
            {defaultCode
              ? `Kode Room "${defaultCode}" tidak memiliki pertandingan aktif. Masukkan kode room lain, buat pertandingan baru, atau hapus kode room.`
              : "Masukkan Kode Pertandingan untuk terhubung langsung ke Room Lomba real-time."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-2 text-left pt-0.5">
          <Field label="Kode Pertandingan (Room Code)" className="block mb-1">
            <input
              className={`${inputCls} font-mono-num text-center tracking-widest text-base font-bold uppercase py-1.5 px-3 shadow-inner`}
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="contoh: UOG-2176"
              autoFocus
            />
          </Field>

          <div className="flex gap-2">
            {defaultCode && (
              <Btn
                tone="outline"
                size="md"
                className="flex-1 text-red-600 border-red-300 hover:bg-red-50 dark:hover:bg-red-950 font-black text-xs whitespace-nowrap py-1.5"
                onClick={onClearRoom}
              >
                HAPUS KODE ROOM
              </Btn>
            )}
            <Btn
              tone="amber"
              size="md"
              className="flex-1 shadow-md font-black text-xs whitespace-nowrap py-1.5"
              icon={Swords}
              onClick={handleSubmit}
            >
              HUBUNGKAN ROOM
            </Btn>
          </div>
        </form>

        <div className="relative flex py-0.5 items-center">
          <div className="flex-grow border-t border-slate-200 dark:border-slate-700"></div>
          <span className="flex-shrink mx-3 text-xs font-bold opacity-60">ATAU</span>
          <div className="flex-grow border-t border-slate-200 dark:border-slate-700"></div>
        </div>

        <div className="flex flex-row gap-2 w-full">
          <Btn
            tone="outline"
            size="md"
            className="flex-1 text-xs font-bold whitespace-nowrap px-2 py-1.5"
            icon={ListChecks}
            onClick={() => navigateTo("/matches")}
          >
            Daftar Pertandingan
          </Btn>
          <Btn
            tone="blue"
            size="md"
            className="flex-1 text-xs font-bold whitespace-nowrap px-2 py-1.5"
            icon={PlusCircle}
            onClick={() => navigateTo("/setup")}
          >
            Pertandingan Baru
          </Btn>
        </div>
      </Panel>
    </div>
  );
}
