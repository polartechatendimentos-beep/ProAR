import { readFile, writeFile } from "node:fs/promises";

const file = new URL("../lib/release-version.ts", import.meta.url);
const source = await readFile(file, "utf8");
const match = source.match(/APP_VERSION\s*=\s*"V(\d+)\.(\d+)"/);
if (!match) throw new Error("APP_VERSION inválida");

let major = Number(match[1]);
let minor = Number(match[2]);
if (minor >= 100) {
  major += 1;
  minor = 0;
} else {
  minor += 1;
}

const next = `V${major}.${minor === 0 ? "0" : String(minor).padStart(2, "0")}`;
await writeFile(file, source.replace(match[0], `APP_VERSION = "${next}"`));
process.stdout.write(`${next}\n`);
