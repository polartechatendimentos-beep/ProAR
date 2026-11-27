export type NfseProviderOutcome = "Autorizada" | "Rejeitada" | "Processando" | "Conferência pendente";
type ProviderRecord = Record<string, unknown>;
const readRecord = (value: unknown): ProviderRecord => value && typeof value === "object" && !Array.isArray(value) ? value as ProviderRecord : {};
export const fiscalStatusText = (value: unknown) => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
const scalar = (value: unknown) => typeof value === "string" || typeof value === "number" ? String(value).trim().slice(0, 200) : "";
function firstValue(...values: unknown[]) { return values.map(scalar).find(Boolean) || ""; }

export function nfseProviderOutcome(responseOk: boolean, raw: unknown) {
 const payload = readRecord(raw);
 const provider = readRecord(payload.result ?? payload.data ?? payload);
 const status = fiscalStatusText(provider.status ?? provider.situacao ?? provider.state);
 const number = firstValue(provider.number, provider.numero, provider.nfseNumber);
 const verificationCode = firstValue(provider.verificationCode, provider.codigoVerificacao, provider.chave, provider.key);
 const protocol = firstValue(provider.protocol, provider.protocolo);
 const markedAuthorized = provider.authorized === true || provider.autorizada === true || provider.issued === true || /^(autorizad[ao]|authorized|aprovad[ao])$/.test(status);
 const markedRejected = /^(rejeitad[ao]|rejected|denegad[ao]|denied)$/.test(status);
 let outcome:NfseProviderOutcome = "Conferência pendente";
 if (responseOk && markedAuthorized && !markedRejected && (number || verificationCode || protocol)) outcome = "Autorizada";
 else if (!markedAuthorized && markedRejected) outcome = "Rejeitada";
 else if (responseOk && !markedAuthorized && /^(processando|processing|pendente|pending|recebid[ao]|received)$/.test(status)) outcome = "Processando";
 return { outcome, number, verificationCode, protocol, message: firstValue(payload.error, payload.message, provider.error, provider.message) };
}

export function nfseIssuanceHold(order:{nfseStatus?:unknown;nfseNumber?:unknown;nfseVerificationCode?:unknown;nfseIssuedAt?:unknown;invoiceNumber?:unknown}):string|null {
 const status=fiscalStatusText(order.nfseStatus);
 if ([order.nfseNumber,order.nfseVerificationCode,order.nfseIssuedAt,order.invoiceNumber].some(scalar)||/^(autorizada|emitida|cancelada)$/.test(status)) {
  return "Esta OS tem histórico ou identificação fiscal. Confira a nota existente; não transmita novamente.";
 }
 if (/^(processando|transmitindo|validando|contingencia|conferencia pendente|erro)$/.test(status)) {
  return "A situação fiscal anterior ainda não está confirmada. Confira no provedor antes de transmitir novamente.";
 }
 return null;
}
