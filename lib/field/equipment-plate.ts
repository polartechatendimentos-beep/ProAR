/** Extraction proposals must be confirmed by a technician before saving equipment records. */
export type PlateProposal = {
  model?: string; serial?: string; capacityBtu?: number; voltageV?: number;
  refrigerant?: string; confidence: number; sourceImageId: string;
};
export function validatePlateProposal(proposal: PlateProposal) {
  const errors: string[] = [];
  if (typeof proposal.sourceImageId !== "string" || !proposal.sourceImageId.trim()) errors.push("IMAGE_REQUIRED");
  if (!Number.isFinite(proposal.confidence) || proposal.confidence < 0 || proposal.confidence > 1) errors.push("CONFIDENCE_INVALID");
  if (proposal.capacityBtu !== undefined && (!Number.isFinite(proposal.capacityBtu) || proposal.capacityBtu <= 0 || proposal.capacityBtu > 500000)) errors.push("CAPACITY_INVALID");
  if (proposal.voltageV !== undefined && (!Number.isFinite(proposal.voltageV) || proposal.voltageV < 12 || proposal.voltageV > 1000)) errors.push("VOLTAGE_INVALID");
  if ([proposal.model,proposal.serial,proposal.refrigerant].some(value=>value!==undefined && typeof value!=="string")) errors.push("TEXT_INVALID");
  if (proposal.serial && proposal.serial.length > 128) errors.push("SERIAL_TOO_LONG");
  return { valid: errors.length === 0, errors, requiresHumanConfirmation: true as const };
}

