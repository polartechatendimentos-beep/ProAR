import { disputePlatformFromUrl } from "./procurement/regional-sources.ts";

type Evidence = { page: number; excerpt: string };
type Finding = Evidence & { value: string };
type PlatformFinding = Finding & { url: string };
const normalize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const months = "janeiro fevereiro marco abril maio junho julho agosto setembro outubro novembro dezembro".split(" ");
const pad = (n: number) => String(n).padStart(2, "0");

function dateKey(y: number, m: number, d: number, h: number, min: number) {
  if (y < 2000 || y > 2099 || m < 1 || m > 12 || d < 1 || d > 31 || h > 23 || min > 59) return "";
  const instant = new Date(Date.UTC(y, m - 1, d));
  return instant.getUTCDate() === d ? `${y}-${pad(m)}-${pad(d)}T${pad(h)}:${pad(min)}` : "";
}

export function radarDeadlineKey(value = "") {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::([0-5]\d)(?:\.\d{1,9})?)?(Z|[+-]\d{2}:\d{2})?$/i.exec(value);
  if (!match) return "";
  const local = dateKey(+match[1], +match[2], +match[3], +match[4], +match[5]);
  if (!local || !match[7]) return local;
  const instant = new Date(value);
  if (!Number.isFinite(instant.valueOf())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(instant);
  const get = (type: string) => parts.find(part => part.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

export function proposalTimeLabel(value: string) {
  return value ? `${value.slice(8, 10)}/${value.slice(5, 7)}/${value.slice(0, 4)} às ${value.slice(11, 13)}h${value.slice(14, 16)}` : "";
}

export function disputeDestination(raw?: string) {
  try {
    const url = new URL(raw || "");
    if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
    const platform = disputePlatformFromUrl(url.href);
    return platform ? { platform, url: url.href } : null;
  } catch { return null; }
}

const date = "(\\d{1,2})(?:[./-](\\d{1,2})[./-]|\\s+de\\s+([a-z]+)\\s+de\\s+)(20\\d{2})";
const time = "(\\d{1,2})\\s*(?:h|:)\\s*([0-5]\\d)(?:\\s*min)?\\b";
const deadline = new RegExp(
  "(?:cadastro das propostas iniciais|prazo (?:limite |final )?(?:para (?:o )?)?(?:envio|recebimento|cadastro|entrega) (?:das|de) propostas|encerramento (?:do recebimento )?das propostas)" +
  "\\s*(?::|-)?\\s*(?:ate\\s+(?:as\\s+)?)?(?:" + time + "\\s+(?:do dia |de |em )?" + date + "|" + date + "\\s*(?:,\\s*)?(?:as\\s+)?" + time + ")", "g",
);
const portal = /(?:local da sessao publica|plataforma (?:da disputa|de licitacoes)|sistema eletronico)\s*[:–-]?\s*(?:plataforma de licitacoes\s*:\s*)?((?:https?:\/\/|www\.)[^\s<>"“”]+)/g;
const rules = [
  { key: "exclusive", label: "Conferir o enquadramento do CNPJ proponente", regex: /participacao exclusiva (?:de|para) (?:mei,?\s*me(?:,?\s*e\s+|,?\s+)epp\b|mei\b|me\b|epp\b|microempreendedor individual|microempresa|empresas? de pequeno porte)/ },
  { key: "accounts", label: "Separar balanço e DRE dos dois últimos exercícios e conferir as exceções", regex: /balanco patrimonial,? demonstracao de resultado de exercicio e demais demonstracoes contabeis dos 2\s*\(dois\) ultimos exercicios sociais/ },
  { key: "ratios", label: "Validar com o contador LG, LC e SG acima de 1,0", regex: /liquidez geral\s*\(lg\),? liquidez corrente\s*\(lc\) e solvencia geral\s*\(sg\) maiores que 1,0\s*\(um\)/ },
  { key: "lot", label: "Cotar o lote inteiro, não somente os serviços de interesse", regex: /menor preco por lote\b/ },
] as const;

function hasTitle(text: string, title: string) {
  return text.includes(normalize(title));
}

export function extractSubmissionCheck(text: string) {
  const deadlines = new Map<string, Finding>();
  const platforms = new Map<string, PlatformFinding>();
  const requirements = new Map<string, Evidence & { key: string; label: string }>();
  const lots = new Set<string>();
  let brasilia = false;
  for (const page of text.matchAll(/\[Página (\d+)\]([\s\S]*?)(?=\[Página \d+\]|$)/g)) {
    const original = page[2].replace(/\s+/g, " ").trim();
    const clean = normalize(original);
    const evidence = (match: RegExpExecArray): Evidence => ({
      page: Number(page[1]), excerpt: original.slice(match.index, match.index + match[0].length).trim(),
    });
    brasilia ||= /horario de brasilia|horario oficial de brasilia/.test(clean);
    for (const match of clean.matchAll(deadline)) {
      const firstTime = match[1] !== undefined;
      const [day, month, named, year, hour, minute] = firstTime
        ? [match[3], match[4], match[5], match[6], match[1], match[2]]
        : [match[7], match[8], match[9], match[10], match[11], match[12]];
      const key = dateKey(+year, month ? +month : months.indexOf(named) + 1, +day, +hour, +minute);
      if (key && !deadlines.has(key)) deadlines.set(key, { ...evidence(match), value: key });
    }
    for (const match of clean.matchAll(portal)) {
      const start = match.index + match[0].length - match[1].length;
      const raw = original.slice(start, start + match[1].length).replace(/[.,;)]*$/, "");
      const dest = disputeDestination(/^www\./i.test(raw) ? "https://" + raw : raw);
      if (dest && !platforms.has(dest.platform)) platforms.set(dest.platform, { ...evidence(match), value: dest.platform, url: dest.url });
    }
    for (const rule of rules) {
      const match = rule.regex.exec(clean);
      if (match && !requirements.has(rule.key)) requirements.set(rule.key, { ...evidence(match), key: rule.key, label: rule.label });
    }
    if (hasTitle(clean, "termo de referência") || clean.includes("lote ")) {
      for (const match of clean.matchAll(/\blote\s+([ivxlcdm]+|\d+)\s*[–-]\s*(?:ar condicionado|climatizador)\b/g)) lots.add(match[1]);
    }
  }
  return { deadlines: [...deadlines.values()], platforms: [...platforms.values()], requirements: [...requirements.values()], lots: lots.size, brasilia };
}

export function submissionDifferences(radarDate: string, radarPlatform: string, doc: ReturnType<typeof extractSubmissionCheck>) {
  return {
    deadline: doc.deadlines.length > 1 || Boolean(radarDate && doc.brasilia && doc.deadlines.some(item => item.value !== radarDate)),
    platform: doc.platforms.length > 1 || Boolean(radarPlatform && doc.platforms.some(item => item.value !== radarPlatform)),
  };
}
