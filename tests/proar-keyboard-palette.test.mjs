import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const palette = Object.fromEntries([...read("app/proar-keyboard-palette.css").matchAll(/--kbd-([\w-]+):(#\w{6});/g)].map(([,key,value])=>[key,value]));
const luminance = hex => hex.slice(1).match(/../g).reduce((sum,byte,i) => {
  const s=parseInt(byte,16)/255;
  return sum+[0.2126,0.7152,0.0722][i]*(s<=0.04045 ? s/12.92 : ((s+0.055)/1.055)**2.4);
},0);
const contrast = (x,y) => {
  const v=[luminance(x),luminance(y)].sort((a,b)=>b-a);
  return (v[0]+.05)/(v[1]+.05);
};
test("a paleta de referência mantém contraste de texto nos dois temas", () => {
  for(const theme of ["","light-"]) {
    for(const surface of ["bg","surface","card","soft","hover"]) {
      for(const ink of ["text","muted","accent"]) {
        const value=contrast(palette[theme+surface],palette[theme+ink]);
        assert.ok(value >= 4.5,`${theme+ink} sobre ${theme+surface}: ${value.toFixed(2)}`);
      }
    }
    for(const action of ["action","action-hover"]) {
      assert.ok(contrast(palette[theme+action],"#ffffff") >= 4.5);
    }
    assert.ok(contrast(palette[theme+"control"],palette[theme+"surface"]) >= 3);
  }
});
test("ERP, Agenda, Atendimento e Mobile referenciam a mesma paleta sem remover alto contraste", () => {
  assert.match(read("app/layout.tsx"),/import "\.\/proar-keyboard-palette\.css"/);
  assert.match(read("app/attendance-color-system.css"),/--ux-bg:var\(--kbd-bg\)/);
  assert.match(read("components/OperationalAgenda.module.css"),/var\(--ux-header\)/);
  assert.match(read("app/atendimento/workspace.module.css"),/--desk-bg:var\(--kbd-bg\)/);
  assert.match(read("app/atendimento/pendencias/page.tsx"),/useAttendancePalette\(\)/);
  assert.match(read("components/ProARFieldMobile.module.css"),/\.app:not\(\.sunlightMode\)\s*\{\s*--field-bg:var\(--kbd-bg\)/);
  assert.match(read("components/ProARFieldMobile.module.css"),/\.app\.sunlightMode/);
});
