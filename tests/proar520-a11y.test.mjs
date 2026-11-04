import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const css = readFileSync(new URL("../app/proar520-layout-a11y.css", import.meta.url), "utf8");

function declarationBlock(selector) {
  const start = css.indexOf(selector);
  assert.notEqual(start, -1, `seletor não encontrado: ${selector}`);
  const open = css.indexOf("{", start);
  const close = css.indexOf("}", open);
  assert.ok(open >= 0 && close > open, `bloco CSS inválido: ${selector}`);
  return css.slice(open + 1, close);
}

function token(block, name) {
  const match = block.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})\\s*;`));
  assert.ok(match, `token --${name} não encontrado`);
  return match[1];
}

function luminance(hex) {
  const channels = hex.slice(1).match(/../g).map((part) => parseInt(part, 16) / 255);
  const linear = channels.map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrast(a, b) {
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

test("tokens de texto e texto secundário mantêm contraste WCAG AA nos temas", () => {
  const scopes = [
    [":root", "light"],
    ['html[data-proar-system-theme="dark"]', "dark"],
    ['html[data-proar-high-contrast="true"]', "high contrast"],
  ];
  for (const [selector, label] of scopes) {
    const block = declarationBlock(selector);
    const background = token(block, "ux-bg");
    for (const foregroundName of ["ux-text", "ux-muted"]) {
      const ratio = contrast(token(block, foregroundName), background);
      assert.ok(ratio >= 4.5, `${label}: --${foregroundName} contra --ux-bg = ${ratio.toFixed(2)}:1`);
    }
  }
});

test("a escala tipográfica se adapta a telas menores e maiores", () => {
  assert.match(css, /font-size:\s*clamp\(1\.5rem,/);
  assert.match(css, /font-size:\s*clamp\(1\.2rem,/);
});

test("regras globais incluem foco de teclado, movimento reduzido e impressão", () => {
  assert.match(css, /:focus-visible/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /@media\s+print/);
});
