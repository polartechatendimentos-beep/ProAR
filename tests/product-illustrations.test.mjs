import test from "node:test";
import assert from "node:assert/strict";
import {inferProductIllustration,productIllustration} from "../lib/product-illustrations.ts";

test("illustration follows the most specific product information and falls back safely",()=>{
  assert.equal(inferProductIllustration({name:"Tubo de cobre 1/4",category:"Infraestrutura"}),"tubulacao");
  assert.equal(inferProductIllustration({name:"Isolamento elastomérico para tubo de cobre"}),"isolamento");
  assert.equal(inferProductIllustration({name:"Placa para Elgin",description:"Ar-condicionado Split Inverter"}),"eletrico");
  assert.equal(inferProductIllustration({name:"Item P-1",description:"Mangueira corrugada de dreno"}),"dreno");
  assert.equal(inferProductIllustration({name:"Gás R-410A para split"}),"fluido");
  assert.equal(inferProductIllustration({name:"Ar-condicionado Split Inverter R32"}),"equipamento");
  assert.equal(inferProductIllustration({name:"Tubo de PVC"}),"generico");
  assert.equal(inferProductIllustration({name:"Ar-condicionado 12.000 BTU",description:"Acompanha tubo"}),"equipamento");
  assert.equal(inferProductIllustration({name:"Item de balcão",description:"Referência 0001"}),"generico");
});

test("illustration is a local fixed asset and never embeds description or alters the original photo",()=>{
  const record={description:'<script>alert(1)</script> tubo cobre',catalogImage:"data:image/webp;base64,photo"};
  const asset=productIllustration(record);
  const svg=decodeURIComponent(asset.url.split(",").slice(1).join(","));
  assert.equal(asset.key,"tubulacao");
  assert.match(svg,/^<svg /);
  assert.doesNotMatch(svg,/<script|photo|alert/i);
  assert.equal(record.catalogImage,"data:image/webp;base64,photo");
  assert.notEqual(asset.url,productIllustration({name:"Placa elétrica"}).url);
});
