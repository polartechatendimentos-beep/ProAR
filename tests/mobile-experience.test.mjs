import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeMobileTheme,resolveMobileTheme,equipmentInspection,resolveEquipmentLabel,mobileSupervision} from '../lib/mobile-experience.ts';
import {openRearCamera} from '../lib/mobile-barcode.ts';
test('aparência mobile normaliza preferências e acompanha o sistema somente no modo automático',()=>{
  assert.equal(normalizeMobileTheme('unknown'),'auto');assert.equal(normalizeMobileTheme(null),'auto');
  for(const dark of [true,false]){assert.equal(resolveMobileTheme('light',dark),'light');assert.equal(resolveMobileTheme('dark',dark),'dark');assert.equal(resolveMobileTheme('auto',dark),dark?'dark':'light');}
});
test('inspeção contextual une tipos conhecidos sem obrigar equipamento ou inventar modelo',()=>{
  assert.deepEqual(equipmentInspection([]),[]);assert.deepEqual(equipmentInspection(['Chiller desconhecido']),[]);
  const rows=equipmentInspection(['Cassete 60000','cassete duplicado','Piso Teto','Hi-Wall']);assert.equal(rows.length,3);
  assert.equal(new Set(rows.map(x=>x.key)).size,3);assert.ok(rows.every(x=>x.required===false));
});
test('etiqueta aceita apenas equipamento já autorizado sem abrir URLs arbitrárias',()=>{
  const origin='https://polartech.proar.online',ids=['EQ-1','EQ-2'];
  assert.equal(resolveEquipmentLabel(' EQ-1 ',origin,ids),'EQ-1');
  assert.equal(resolveEquipmentLabel('/consulta?equipmentId=EQ-2',origin,ids),'EQ-2');
  for(const input of ['EQ-3','https://evil.example/?equipmentId=EQ-1','javascript:alert(1)','//evil.example/?equipmentId=EQ-1','/equipamento/token-publico','x'.repeat(2049)])assert.equal(resolveEquipmentLabel(input,origin,ids),null);
});
test('supervisão conta somente a projeção fornecida e separa encerradas e datas indefinidas',()=>{
  assert.deepEqual(mobileSupervision([{status:'Aberto',date:'2026-10-14',checkInAt:''},{status:'Em andamento',date:'2026-10-15',checkInAt:'2026-10-15T10:00:00Z'},{status:'Concluída',date:'2026-10-14',checkInAt:'sim'},{status:'Cancelada',date:'2026-10-15',checkInAt:''},{status:'Aberto',date:'',checkInAt:''}],'2026-10-15'),{open:3,overdue:1,active:1,today:1});
});
test('câmera encerra as trilhas quando a reprodução falha e ao fechar o leitor',async()=>{
  const previous=Object.getOwnPropertyDescriptor(globalThis,'navigator');let stopped=0;
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{mediaDevices:{getUserMedia:async()=>({getTracks:()=>[{stop:()=>stopped++}]})}}});
  try{
    const failed={srcObject:null,play:async()=>{throw new Error('blocked');}};await assert.rejects(()=>openRearCamera(failed),/blocked/);assert.equal(stopped,1);assert.equal(failed.srcObject,null);
    const video={srcObject:null,play:async()=>{}};const close=await openRearCamera(video);assert.ok(video.srcObject);close();assert.equal(stopped,2);assert.equal(video.srcObject,null);
  }finally{if(previous)Object.defineProperty(globalThis,'navigator',previous);else delete globalThis.navigator;}
});
