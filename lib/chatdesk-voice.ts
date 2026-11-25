export type AppointmentVoiceDraft = {
  name: string; address: string; service: string; phone: string; date: string; time: string;
  city: string; state: string; street: string;
};
const clean = (value: string) => value.replace(/^[\s,.;:—-]+|[\s,.;:—-]+$/g, "").replace(/\s+/g, " ").trim();
function saoPauloToday(now: number) { return new Date(now).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }); }
function shiftDay(date: string, amount: number) {
  const value = new Date(date + "T12:00:00-03:00");
  value.setUTCDate(value.getUTCDate() + amount);
  return new Date(value.getTime()).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}
/** This guided form only previews one visit; never discard a second date or time silently. */
export function mentionsMultipleVisitSlots(input: string) {
  const text = input.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
  const dates = text.match(/\b(?:hoje|amanha|segunda(?:-feira)?|terca(?:-feira)?|quarta(?:-feira)?|quinta(?:-feira)?|sexta(?:-feira)?|sabado|domingo|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\b/g) || [];
  const times = text.match(/\b(?:as\s+\d{1,2}(?::\d{2}|h\d{0,2})?|\d{1,2}h\d{0,2}|(?:[01]?\d|2[0-3]):[0-5]\d)\b/g) || [];
  return new Set(dates.map(date=>date.replace("-feira", ""))).size > 1 || new Set(times.map(time=> {
     const match = /(\d{1,2})(?::|h)?(\d{2})?/.exec(time);
     return match ? Number(match[1])*60+Number(match[2] || 0) : time;
  })).size > 1 || /\b(?:duas visitas|separadamente|em dias diferentes)\b/.test(text);
}
export function parseAppointmentVoice(input: string, now = Date.now()): AppointmentVoiceDraft {
  const text = input.replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 1500);
  const street = /\b(?:rua|r\.?|avenida|av\.?|alameda|travessa|estrada|rodovia|praça|praca)\b/i.exec(text);
  const streetStart = street?.index ?? -1;
  const issue = /\b(?:ar|a[eé]|a\s*e|aparelho|equipamento|split)\b[^.!?\n]{0,180}/i.exec(text);
  const issueStart = issue?.index ?? -1;
  const dateToken = /\b(?:amanh[ãa]|hoje|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\b/i.exec(text);
  const timeToken = /\b(?:às|as)\s*\d{1,2}(?::\d{2}|h\d{0,2})?\b|\b\d{1,2}h\d{0,2}\b/i.exec(text);
  const phoneToken = /\b(?:telefone|celular|whatsapp)\D*((?:\+?55\s*)?\(?\d{2}\)?[\s-]*\d{4,5}[\s-]*\d{4})\b/i.exec(text);
  let name = "";
  if (streetStart >= 0) name = clean(text.slice(0, streetStart)).replace(/^(?:agendar|marcar|cliente)\s+(?:para\s+)?/i, "");
  else if (issueStart >= 0) name = clean(text.slice(0, issueStart)).replace(/^(?:agendar|marcar|cliente)\s+(?:para\s+)?/i, "");
  let address = "";
  if (streetStart >= 0) {
    const end = issueStart > streetStart ? issueStart : text.length;
    address = clean(text.slice(streetStart, end));
    if (dateToken && dateToken.index > streetStart && dateToken.index < end) address = clean(text.slice(streetStart, dateToken.index));
  }
  const cityMatch = address.match(/\s[-–]\s*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ ]{2,}?)(?:\/([A-Za-z]{2}))?$/);
  const city = clean(cityMatch?.[1] || "");
  const state = (cityMatch?.[2] || "").toUpperCase();
  const addressWithoutCity = cityMatch ? clean(address.slice(0, cityMatch.index)) : address;
  const streetMatch = addressWithoutCity.match(/^(?:rua|r\.?|avenida|av\.?|alameda|travessa|estrada|rodovia|praça|praca)\s+([^,]+)/i);
  const streetName = clean(streetMatch?.[1] || "").replace(/\([^)]*\)/g, "").replace(/\b(?:n(?:ú|u)mero|n[º°o])\s*\d+[A-Za-z]?\b.*$/i, "").replace(/,.*$/, "");
  const symptom = issue ? clean(issue[0]) : "";
  const service = symptom ? "Relato do cliente: " + symptom : "";
  let date = "";
  if (dateToken) {
    const token = dateToken[0].toLocaleLowerCase("pt-BR");
    if (token.startsWith("amanh")) date = shiftDay(saoPauloToday(now), 1);
    else if (token === "hoje") date = saoPauloToday(now);
    else {
      const [day, month, yearText] = token.split("/");
      const year = yearText ? (yearText.length === 2 ? "20" + yearText : yearText) : saoPauloToday(now).slice(0, 4);
      date = year + "-" + month.padStart(2, "0") + "-" + day.padStart(2, "0");
    }
  }
  let time = "";
  if (timeToken) {
    const match = timeToken[0].match(/(\d{1,2})(?::|h)?(\d{2})?/i);
    if (match) time = match[1].padStart(2, "0") + ":" + (match[2] || "00");
  }
  return { name: clean(name), address, service, phone: clean(phoneToken?.[1] || ""), date, time, city, state, street: clean(streetName) };
}
