/** Brazilian tax document check digits; accepts formatted or numeric values. */
export function validCpf(value: string): boolean {
  const s = value.replace(/\D/g, "");
  if (s.length !== 11 || /^(\d)\1+$/.test(s)) return false;
  for (const length of [9, 10]) {
    const sum = [...s.slice(0, length)].reduce((acc, digit, index) => acc + Number(digit) * (length + 1 - index), 0);
    const expected = (sum * 10) % 11 % 10;
    if (Number(s[length]) !== expected) return false;
  }
  return true;
}
export function validCnpj(value: string): boolean {
  const s = value.replace(/\D/g, "");
  if (s.length !== 14 || /^(\d)\1+$/.test(s)) return false;
  for (const length of [12, 13]) {
    const weights = length === 12 ? [5,4,3,2,9,8,7,6,5,4,3,2] : [6,5,4,3,2,9,8,7,6,5,4,3,2];
    const sum = [...s.slice(0, length)].reduce((acc, digit, index) => acc + Number(digit) * weights[index], 0);
    const remainder = sum % 11;
    if (Number(s[length]) !== (remainder < 2 ? 0 : 11 - remainder)) return false;
  }
  return true;
}
export function validCpfCnpj(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  return digits.length === 11 ? validCpf(digits) : digits.length === 14 && validCnpj(digits);
}
