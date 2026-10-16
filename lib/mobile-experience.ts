export type MobileTheme = "light" | "dark" | "auto";
export function normalizeMobileTheme(value: unknown): MobileTheme {
  return value === "light" || value === "dark" ? value : "auto";
}
export function resolveMobileTheme(value: MobileTheme, systemDark: boolean) {
  return value === "auto" ? (systemDark ? "dark" : "light") : value;
}

/** Resolve only equipment IDs already returned by the authenticated OS API. */
export function resolveEquipmentLabel(input: string, origin: string, allowedIds: string[]) {
  const raw = input.trim();
  if (!raw || raw.length > 2048) return null;
  if (allowedIds.includes(raw)) return raw;
  try {
    const url = new URL(raw, origin);
    if (url.origin !== new URL(origin).origin || !/^https?:$/.test(url.protocol)) return null;
    const id = url.searchParams.get("equipmentId");
    return id && allowedIds.includes(id) ? id : null;
  } catch { return null; }
}

export function equipmentInspection(labels: string[]) {
  const text = labels.join(" ").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const rows: {key:string;label:string;required:boolean}[] = [];
  if (/cassete|cassette/.test(text)) rows.push({key:"inspectionCassetteDrain",label:"Cassete: inspecionar bomba e bandeja de condensado",required:false});
  if (/piso[\s-]*teto/.test(text)) rows.push({key:"inspectionFloorCeilingFixing",label:"Piso-teto: inspecionar fixações e circulação de ar",required:false});
  if (/split|hi[\s-]*wall/.test(text)) rows.push({key:"inspectionSplitFilters",label:"Split: inspecionar filtros, serpentinas e drenagem",required:false});
  return rows;
}

/** These counts use only the permission-filtered bootstrap projection. */
export function mobileSupervision(orders: {status:string;date:string;checkInAt:string}[], today: string) {
  const open = orders.filter(o=>!/conclu[ií]d|cancelad|finalizad|encerrad/i.test(o.status));
  return {open:open.length, overdue:open.filter(o=>/^\d{4}-\d{2}-\d{2}$/.test(o.date)&&o.date<today).length,
    active:open.filter(o=>Boolean(o.checkInAt)).length, today:open.filter(o=>o.date===today).length};
}
