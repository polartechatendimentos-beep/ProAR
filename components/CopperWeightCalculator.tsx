"use client";

import React, { useState } from "react";
import { Calculator, X } from "lucide-react";

const COPPER_WEIGHT_PER_METER: Record<string, number> = {
  "1/4\"": 0.150,
  "3/8\"": 0.203,
  "1/2\"": 0.266,
};

interface CopperWeightCalculatorProps {
  dark?: boolean;
}

export function CopperWeightCalculator({ dark = false }: CopperWeightCalculatorProps) {
  const [open, setOpen] = useState(false);
  const [diameter, setDiameter] = useState("1/4\"");
  const [meters, setMeters] = useState("");
  const length = Math.max(0, Number(meters.replace(",", ".")) || 0);
  const weight = length * COPPER_WEIGHT_PER_METER[diameter];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold transition ${dark ? "border-slate-700 bg-slate-800 text-blue-300 hover:bg-slate-700" : "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"}`}
      >
        <Calculator className="h-3.5 w-3.5" /> Converter m → kg cobre
      </button>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="copper-calculator-title" className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 text-slate-900 shadow-2xl">
            <header className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h3 id="copper-calculator-title" className="flex items-center gap-2 text-base font-black"><Calculator className="h-4 w-4 text-blue-600" /> Conversão de tubo de cobre</h3>
                <p className="mt-1 text-xs text-slate-500">Informe a metragem e a bitola para estimar o peso.</p>
              </div>
              <button type="button" aria-label="Fechar" onClick={() => setOpen(false)} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"><X className="h-4 w-4" /></button>
            </header>
            <div className="grid grid-cols-2 gap-3">
              <label className="grid gap-1.5 text-xs font-bold text-slate-600">Bitola
                <select value={diameter} onChange={(event) => setDiameter(event.target.value)} className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900">
                  {Object.keys(COPPER_WEIGHT_PER_METER).map((size) => <option key={size} value={size}>{size}</option>)}
                </select>
              </label>
              <label className="grid gap-1.5 text-xs font-bold text-slate-600">Comprimento (m)
                <input type="text" inputMode="decimal" value={meters} onChange={(event) => setMeters(event.target.value.replace(/[^0-9.,]/g, ""))} placeholder="Ex.: 12,5" className="h-10 rounded-lg border border-slate-300 px-3 text-sm text-slate-900" />
              </label>
            </div>
            <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 p-4">
              <div className="flex items-center justify-between gap-3"><span className="text-xs font-semibold text-slate-600">Peso estimado</span><strong aria-live="polite" className="text-2xl font-black text-blue-700">{weight.toLocaleString("pt-BR", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} kg</strong></div>
              <p className="mt-2 text-[11px] text-slate-500">Referência: {COPPER_WEIGHT_PER_METER[diameter].toLocaleString("pt-BR", { minimumFractionDigits: 3 })} kg/m. O peso real pode variar conforme a espessura da parede do tubo.</p>
            </div>
            <div className="mt-5 flex justify-end"><button type="button" onClick={() => setOpen(false)} className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700">Fechar</button></div>
          </section>
        </div>
      )}
    </>
  );
}
