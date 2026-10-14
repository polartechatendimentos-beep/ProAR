import test from 'node:test';
import assert from 'node:assert/strict';
import {formatLocalFieldReport,localFieldReportMessages} from '../lib/local-field-report.ts';
test('local formatter preserves supplied facts without inventing conclusions',()=>{assert.equal(formatLocalFieldReport(' pressão  80 psi ',' troca de filtro '),'DIAGNÓSTICO E MEDIÇÕES\npressão 80 psi\n\nSERVIÇO EXECUTADO\ntroca de filtro');assert.equal(formatLocalFieldReport('',''),'');assert.ok(!formatLocalFieldReport('','Inspeção').includes('garantia'));});
test('model prompt bounds input and separates untrusted narrative from instructions',()=>{const messages=localFieldReportMessages('d'.repeat(5000),'s'.repeat(9000));const input=JSON.parse(messages[1].content);assert.equal(input.diagnostico.length,4000);assert.equal(input.servicoExecutado.length,8000);assert.match(messages[0].content,/não invente/);});
