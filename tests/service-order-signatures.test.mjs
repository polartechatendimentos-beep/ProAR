import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareOrderSignatures,assignedSignatureEmployee,readOrderSignatures,safeSignatureImage} from '../lib/service-order-signatures.ts';
import {prepareOperationalState} from '../lib/operational-ledger.ts';
const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l7sAAAAASUVORK5CYII=';
const now='2026-10-15T21:10:00Z',employee={id:'EMP-1',name:'Técnico Teste',employeeSignature:image,status:'Ativo'};
const open={id:'OS-1',tech:'Técnico Teste',employeeId:'EMP-1',client:'Cliente',status:'Em andamento'};
const completed=()=>({...open,status:'Concluída',customerSignature:image,customerSignatureName:'Responsável'});
test('default signature follows canonical assignment; duplicate names and invalid explicit IDs do not guess another employee',()=>{
  assert.equal(assignedSignatureEmployee(open,[employee]).id,'EMP-1');
  assert.equal(assignedSignatureEmployee({...open,employeeId:'unknown'},[employee]),undefined);
  assert.equal(assignedSignatureEmployee({tech:'Tecnico Teste'},[employee]).id,'EMP-1');
  assert.equal(assignedSignatureEmployee({tech:'tech.login'},[{...employee,employeeUsername:'tech.login'}]).id,'EMP-1');
  assert.equal(assignedSignatureEmployee({tech:'Técnico Teste'},[employee,{...employee,id:'EMP-2'}]),undefined);
  assert.equal(assignedSignatureEmployee(open,[{...employee,status:'Inativo'}]),undefined);
});
test('closing snapshots client and assigned technician signatures, source and server timestamp',()=>{
  const next=prepareOrderSignatures(open,completed(),[employee],now);
  assert.equal(next.receiptSignatures.client.image,image);assert.equal(next.receiptSignatures.client.name,'Responsável');
  assert.equal(next.receiptSignatures.technician.image,image);assert.equal(next.receiptSignatures.technician.source,'employee-default');assert.equal(next.receiptSignatures.technician.employeeId,'EMP-1');assert.equal(next.receiptSignatures.capturedAt,now);assert.equal(next.checkOutAt,now);
  assert.equal(next.clientSignature,image);assert.equal(next.technicianSignature,image);
});
test('later profile changes and client snapshot spoofing cannot change completed receipt signatures',()=>{
  const previous=prepareOrderSignatures(open,completed(),[employee],now),incoming={...previous,receiptSignatures:{client:{image:'forged'}}};
  const next=prepareOrderSignatures(previous,incoming,[{...employee,employeeSignature:''}],'2026-10-16');
  assert.deepEqual(next.receiptSignatures,previous.receiptSignatures);
  assert.equal(prepareOrderSignatures({...completed(),receiptSignatures:undefined},completed(),[employee],now).receiptSignatures,undefined);
});
test('legacy client field and per-order technician signature are retained instead of employee template',()=>{
  const next=prepareOrderSignatures(open,{...open,status:'Concluída',clientSignature:image,technicianSignature:image},[employee],now);
  assert.equal(next.customerSignature,image);assert.equal(next.receiptSignatures.technician.source,'order');assert.equal(readOrderSignatures(next).client.image,image);
  assert.equal(safeSignatureImage('https://example/sign.png'),'');assert.equal(safeSignatureImage('data:image/svg+xml;base64,AAAA'),'');assert.equal(safeSignatureImage('data:image/png;base64,'+'A'.repeat(350001)),'');
});
test('employee signature storage requires staff permission and server-authored metadata/audit; closure uses the same ledger path',()=>{
  const previous={customers:[],serviceOrders:[open],moduleRecords:{Funcionários:[{...employee,employeeSignature:undefined}]}};
  const incoming=structuredClone(previous);incoming.moduleRecords.Funcionários[0].employeeSignature=image;incoming.moduleRecords.Funcionários[0].employeeSignatureUpdatedBy='forged';
  assert.throws(()=>prepareOperationalState(previous,incoming,{username:'tech',can:p=>p==='os.editar'},now),/não autorizada/);
  const saved=prepareOperationalState(previous,incoming,{username:'admin',can:()=>true},now);
  assert.equal(saved.moduleRecords.Funcionários[0].employeeSignatureUpdatedBy,'admin');
  assert.ok(saved.moduleRecords['Auditoria operacional'].some(item=>/Assinatura padrão/.test(item.action)));
  const finish=structuredClone(saved);finish.serviceOrders[0]=completed();
  const closed=prepareOperationalState(saved,finish,{username:'tech',can:p=>p==='os.editar'},now);
  assert.equal(closed.serviceOrders[0].receiptSignatures.technician.image,image);
  const invalid=structuredClone(saved);invalid.moduleRecords.Funcionários[0].employeeSignature='javascript:alert(1)';assert.throws(()=>prepareOperationalState(saved,invalid,{username:'admin',can:()=>true},now),/Assinatura padrão inválida/);
});

test('signature audit records changes without copying image bytes into the log',async()=>{const {diffAuditRecord}=await import('../lib/audit-utils.ts');const changes=diffAuditRecord({employeeSignature:''},{employeeSignature:image});assert.equal(changes[0].after,'Registrada');assert.ok(!JSON.stringify(changes).includes('data:image'));});
