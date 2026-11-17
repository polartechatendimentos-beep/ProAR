import test from 'node:test';
import assert from 'node:assert/strict';
import {chatReplyContext} from '../lib/chatdesk-ai-context.ts';
test('sugestão exclui notas internas e eventos e limita histórico e modelos',()=>{
 const messages=[{direction:'note',text:'Dados internos'},{direction:'event',text:'Evento interno'},...Array.from({length:15},(_,i)=>({direction:i%2?'in':'out',text:String(i)}))];
 const context=chatReplyContext(messages,'Boa tarde','completar',Array.from({length:10},()=> 'Modelo aprovado'));
 assert.equal(context.messages.length,12);assert.deepEqual(context.messages[0],{direction:'in',text:'3'});assert.equal(context.references.length,8);assert.equal(JSON.stringify(context).includes('Dados internos'),false);assert.equal(context.draft,'Boa tarde');
});
test('limita cada parte do contexto sem alterar os dados originais',()=>{
 const messages=[{direction:'in',text:'a'.repeat(1800)}],references=['b'.repeat(1500)];
 const context=chatReplyContext(messages,'c'.repeat(4000),'melhorar',references);
 assert.equal(context.messages[0].text.length,1200);assert.equal(context.references[0].length,600);assert.equal(context.draft.length,3000);assert.equal(messages[0].text.length,1800);
});
