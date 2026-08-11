import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const PREFIX = "scrypt";
const KEY_LENGTH = 64;

function safeEqualHex(left: string, right: string) {
  try {
    const a = Buffer.from(left, "hex");
    const b = Buffer.from(right, "hex");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch { return false; }
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, KEY_LENGTH).toString("hex");
  return `${PREFIX}$${salt}$${derived}`;
}

export function verifyPassword(password: string, stored: string) {
  if (stored.startsWith(`${PREFIX}$`)) {
    const [, salt, expected] = stored.split("$");
    if (!salt || !expected) return false;
    const derived = scryptSync(password, salt, KEY_LENGTH).toString("hex");
    return safeEqualHex(derived, expected);
  }
  // Compatibilidade temporária com usuários trial criados antes da migração.
  const legacy = createHash("sha256").update(password).digest("hex");
  return safeEqualHex(legacy, stored);
}
