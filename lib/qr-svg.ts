/**
 * Self-contained QR Code Model 2 encoder (version 10, error correction L).
 * Byte mode, 271-byte capacity. No external service receives the signed URL.
 * The quiet zone is four modules on every side.
 */
const VERSION = 10;
const SIZE = VERSION * 4 + 17;
const RAW_CODEWORDS = 346;
const ECC_PER_BLOCK = 18;
const BLOCKS = 4;
const DATA_CODEWORDS = RAW_CODEWORDS - ECC_PER_BLOCK * BLOCKS;

function multiply(a: number, b: number) {
  let result = 0;
  for (let i = 7; i >= 0; i--) {
    result = (result << 1) ^ ((result >>> 7) * 0x11d);
    result ^= ((b >>> i) & 1) * a;
  }
  return result;
}

function divisor(degree: number) {
  const coefficients = new Uint8Array(degree);
  coefficients[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < degree; j++) {
      coefficients[j] = multiply(coefficients[j], root);
      if (j + 1 < degree) coefficients[j] ^= coefficients[j + 1];
    }
    root = multiply(root, 2);
  }
  return coefficients;
}

function remainder(data: number[], polynomial: Uint8Array) {
  const result = new Uint8Array(polynomial.length);
  for (const value of data) {
    const factor = value ^ result[0];
    result.copyWithin(0, 1);
    result[result.length - 1] = 0;
    for (let i = 0; i < result.length; i++) result[i] ^= multiply(polynomial[i], factor);
  }
  return [...result];
}

function codewords(value: string) {
  const bytes = new TextEncoder().encode(value);
  if (bytes.length > 271) throw new Error("O link excede a capacidade da etiqueta QR.");
  const bits: number[] = [];
  const append = (number: number, length: number) => {
    for (let i = length - 1; i >= 0; i--) bits.push((number >>> i) & 1);
  };
  append(4, 4); // Byte mode
  append(bytes.length, 16); // Versions 10–40 use 16-bit byte counts
  for (const byte of bytes) append(byte, 8);
  append(0, Math.min(4, DATA_CODEWORDS * 8 - bits.length));
  while (bits.length % 8) bits.push(0);
  const data: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | bits[i + j];
    data.push(byte);
  }
  let padding = 0xec;
  while (data.length < DATA_CODEWORDS) { data.push(padding); padding ^= 0xfd; }
  const polynomial = divisor(ECC_PER_BLOCK);
  const blocks: { data: number[]; ecc: number[] }[] = [];
  let cursor = 0;
  for (let i = 0; i < BLOCKS; i++) {
    const length = 68 + (i >= 2 ? 1 : 0);
    const part = data.slice(cursor, cursor + length);
    blocks.push({ data: part, ecc: remainder(part, polynomial) });
    cursor += length;
  }
  const output: number[] = [];
  for (let i = 0; i < 69; i++) for (const block of blocks) if (i < block.data.length) output.push(block.data[i]);
  for (let i = 0; i < ECC_PER_BLOCK; i++) for (const block of blocks) output.push(block.ecc[i]);
  if (output.length !== RAW_CODEWORDS) throw new Error("Falha ao montar o QR Code.");
  return output;
}

export function qrMatrix(value: string): boolean[][] {
  const bytes = codewords(value);
  const modules = Array.from({ length: SIZE }, () => Array<boolean>(SIZE).fill(false));
  const reserved = Array.from({ length: SIZE }, () => Array<boolean>(SIZE).fill(false));
  const set = (x: number, y: number, black: boolean) => {
    if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return;
    modules[y][x] = black;
    reserved[y][x] = true;
  };
  const finder = (cx: number, cy: number) => {
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const distance = Math.max(Math.abs(dx), Math.abs(dy));
      set(cx + dx, cy + dy, distance !== 4 && (distance === 3 || distance <= 1));
    }
  };
  for (let i = 0; i < SIZE; i++) {
    set(6, i, i % 2 === 0);
    set(i, 6, i % 2 === 0);
  }
  finder(3, 3);
  finder(SIZE - 4, 3);
  finder(3, SIZE - 4);
  for (const y of [6, 28, 50]) for (const x of [6, 28, 50]) {
    if ((x === 6 && y === 6) || (x === 6 && y === 50) || (x === 50 && y === 6)) continue;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const distance = Math.max(Math.abs(dx), Math.abs(dy));
      set(x + dx, y + dy, distance !== 1);
    }
  }
  let rem = VERSION;
  for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
  const versionBits = (VERSION << 12) | rem;
  for (let i = 0; i < 18; i++) {
    const bit = ((versionBits >>> i) & 1) !== 0;
    const a = SIZE - 11 + i % 3;
    const b = Math.floor(i / 3);
    set(a, b, bit);
    set(b, a, bit);
  }
  const formatData = 1 << 3; // ECC L, mask 0
  rem = formatData;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  const formatBits = ((formatData << 10) | rem) ^ 0x5412;
  const bit = (i: number) => ((formatBits >>> i) & 1) !== 0;
  for (let i = 0; i <= 5; i++) set(8, i, bit(i));
  set(8, 7, bit(6)); set(8, 8, bit(7)); set(7, 8, bit(8));
  for (let i = 9; i < 15; i++) set(14 - i, 8, bit(i));
  for (let i = 0; i < 8; i++) set(SIZE - 1 - i, 8, bit(i));
  for (let i = 8; i < 15; i++) set(8, SIZE - 15 + i, bit(i));
  set(8, SIZE - 8, true);

  const stream: number[] = [];
  for (const byte of bytes) for (let i = 7; i >= 0; i--) stream.push((byte >>> i) & 1);
  let index = 0;
  let upwards = true;
  for (let right = SIZE - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let row = 0; row < SIZE; row++) {
      const y = upwards ? SIZE - 1 - row : row;
      for (let dx = 0; dx < 2; dx++) {
        const x = right - dx;
        if (reserved[y][x]) continue;
        const dataBit = index < stream.length && stream[index] === 1;
        modules[y][x] = dataBit !== ((x + y) % 2 === 0); // QR mask 0
        index++;
      }
    }
    upwards = !upwards;
  }
  if (index < stream.length) throw new Error("Falha ao posicionar os módulos do QR Code.");
  return modules;
}

export function qrSvg(value: string) {
  const matrix = qrMatrix(value);
  const quiet = 4;
  const dimension = SIZE + quiet * 2;
  const cells: string[] = [];
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    if (matrix[y][x]) cells.push(`M${x + quiet} ${y + quiet}h1v1h-1z`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dimension} ${dimension}" role="img" aria-label="QR Code de consulta do equipamento"><rect width="${dimension}" height="${dimension}" fill="#fff"/><path d="${cells.join("")}" fill="#000"/></svg>`;
}
