import { readdir } from "node:fs/promises";
for (const filename of (await readdir(new URL(".", import.meta.url))).filter(name => name.endsWith(".test.mjs")).sort()) {
  await import(new URL(filename, import.meta.url));
}
