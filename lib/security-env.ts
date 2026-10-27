/** Segurança de configurações sensíveis em execução de servidor. */
export function requiredSecret(name: string, minimumLength = 32) {
  const value = process.env[name]?.trim() ?? "";
  if (value.length < minimumLength) {
    throw new Error(`${name} não configurado ou inseguro.`);
  }
  return value;
}
