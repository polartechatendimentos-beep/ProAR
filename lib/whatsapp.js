export function getAccounts() {
  const raw = process.env.WHATSAPP_ACCOUNTS_JSON;
  if (!raw) return {};
  return JSON.parse(raw);
}
export function getAccount(accountKey) {
  const account = getAccounts()[accountKey];
  if (!account) throw new Error(`Conta não configurada: ${accountKey}`);
  return account;
}
export function findAccountByPhoneNumberId(phoneNumberId) {
  for (const [key, account] of Object.entries(getAccounts())) {
    if (String(account.phoneNumberId) === String(phoneNumberId)) return { key, ...account };
  }
  return null;
}
export function getGraphVersion() {
  return process.env.META_GRAPH_VERSION || "v24.0";
}