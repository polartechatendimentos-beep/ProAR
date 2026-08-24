/** Assistência local, conservadora e revisável. Nunca acrescenta fatos técnicos. */
export function improveTechnicalText(value: string, kind: "observacao" | "cliente" = "observacao") {
  const text = value.trim().replace(/\s+/g, " ");
  if (!text) return "";
  const normalized = text.charAt(0).toUpperCase() + text.slice(1).replace(/[.]+$/, "");
  return kind === "cliente"
    ? `Atualização do atendimento: ${normalized}.`
    : `Registro técnico: ${normalized}. Recomenda-se manter o acompanhamento conforme as condições observadas.`;
}
