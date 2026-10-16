/** Pure field-engineering calculations. No charge/discharge diagnosis from a single reading. */
export type Refrigerant = "R22" | "R32" | "R410A";
export type SaturationPoint = { pressurePsiGauge: number; dewC: number; bubbleC: number };
export type RefrigerantTable = { refrigerant: Refrigerant; source: string; version: string; points: SaturationPoint[] };
export type Reading = {
  refrigerant: Refrigerant;
  pressurePsiGauge: number;
  suctionLineC?: number;
  liquidLineC?: number;
};
export function interpolateSaturation(points: SaturationPoint[], pressure: number, property: "dewC" | "bubbleC") {
  if (!Number.isFinite(pressure) || pressure < 0) throw new Error("PRESSURE_INVALID");
  const sorted = [...points].sort((a, b) => a.pressurePsiGauge - b.pressurePsiGauge);
  if (sorted.length < 2 || sorted.some(p => !Number.isFinite(p.pressurePsiGauge) || !Number.isFinite(p[property]))) throw new Error("TABLE_INVALID");
  if (sorted.some((point,index)=>index>0 && point.pressurePsiGauge===sorted[index-1].pressurePsiGauge)) throw new Error("TABLE_DUPLICATE_PRESSURE");
  if (pressure < sorted[0].pressurePsiGauge || pressure > sorted[sorted.length - 1].pressurePsiGauge) throw new Error("PRESSURE_OUTSIDE_TABLE");
  for (let i = 1; i < sorted.length; i++) {
    const low = sorted[i - 1], high = sorted[i];
    if (pressure <= high.pressurePsiGauge) {
      if (high.pressurePsiGauge === low.pressurePsiGauge) throw new Error("TABLE_DUPLICATE_PRESSURE");
      return low[property] + (pressure - low.pressurePsiGauge) * (high[property] - low[property]) / (high.pressurePsiGauge - low.pressurePsiGauge);
    }
  }
  throw new Error("PRESSURE_OUTSIDE_TABLE");
}
export function calculateHvacReading(reading: Reading, table: RefrigerantTable) {
  if (reading.refrigerant !== table.refrigerant) throw new Error("REFRIGERANT_MISMATCH");
  if (!table.source.trim() || !table.version.trim()) throw new Error("TABLE_PROVENANCE_REQUIRED");
  const dewC = interpolateSaturation(table.points, reading.pressurePsiGauge, "dewC");
  const bubbleC = interpolateSaturation(table.points, reading.pressurePsiGauge, "bubbleC");
  if (reading.suctionLineC !== undefined && !Number.isFinite(reading.suctionLineC)) throw new Error("TEMPERATURE_INVALID");
  if (reading.liquidLineC !== undefined && !Number.isFinite(reading.liquidLineC)) throw new Error("TEMPERATURE_INVALID");
  return {
    refrigerant: reading.refrigerant,
    saturationDewC: dewC,
    saturationBubbleC: bubbleC,
    superheatK: reading.suctionLineC === undefined ? null : reading.suctionLineC - dewC,
    subcoolingK: reading.liquidLineC === undefined ? null : bubbleC - reading.liquidLineC,
    tableSource: table.source,
    tableVersion: table.version,
    advisory: "Resultado de medição, não diagnóstico conclusivo de carga. Confirmar modo, estabilização, vazamentos, fluxo de ar e fabricante.",
  };
}

