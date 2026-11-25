import test from 'node:test';
import assert from 'node:assert/strict';
import { applyChatDeliveryReceipt, completeChatSend } from '../lib/chatdesk-delivery.ts';
import { chatQueuePriority, chatQueueSummary, sortChatQueue } from '../lib/chatdesk-local.ts';

const clock = Date.parse('2026-11-25T15:10:00Z');
const ago = minutes => new Date(clock - minutes * 60_000).toISOString();
const out = (extra = {}) => ({ id: 'local-1', direction: 'out', at: ago(3), actor: 'local-assistant', status: 'processing', text: 'Olá', ...extra });
const input = (text, minutes = 4) => ({ id: 'in', direction: 'in', at: ago(minutes), text });
const chat = (messages, props = {}) => ({ companyId:'A', phone:'5517000000000', name:'Teste', stage:'Novo contato', messages, requests:[], updatedAt:ago(0), ...props });
const delivered = id => ({ providerMessageId: id, deliveryStatus: 'delivered' });

test('early receipt is consumed only after the exact provider ID is returned', () => {
  const starting = chat([out()]);
  const early = applyChatDeliveryReceipt(starting, delivered('provider-1'), clock);
  assert.equal(early.messages[0].deliveryStatus, undefined);
  assert.equal(early.pendingDeliveryReceipts.length, 1);
  assert.equal(applyChatDeliveryReceipt(early, delivered('provider-1'), clock), null);
  assert.equal(completeChatSend(early, 'wrong', 'accepted', 'provider-1', clock), null);
  assert.equal(completeChatSend(early, 'local-1', 'accepted', 'provider-2', clock).messages[0].deliveryStatus, undefined);
  const sent = completeChatSend(early, 'local-1', 'accepted', 'provider-1', clock);
  assert.equal(sent.messages[0].deliveryStatus, 'delivered');
  assert.deepEqual(sent.pendingDeliveryReceipts, []);
  assert.equal(applyChatDeliveryReceipt(sent, { ...delivered('provider-1'), deliveryStatus:'failed' }, clock), null);
  assert.equal(applyChatDeliveryReceipt(sent, { ...delivered('provider-1'), deliveryStatus:'read' }, clock).messages[0].deliveryStatus, 'read');
  assert.equal(completeChatSend(early, 'local-1', 'accepted', 'provider-1', clock + 6 * 60_000).messages[0].deliveryStatus, undefined);
  assert.equal(applyChatDeliveryReceipt(chat([out({ status: 'accepted', providerMessageId: 'other' })]), delivered('provider-1'), clock), null);
  assert.equal(applyChatDeliveryReceipt(null, delivered('provider-1'), clock), null);
});

test('queue flags a recent provider failure or uncertain send and customer follow-up, not courtesy replies', () => {
  const cq = value => chatQueuePriority(chatQueueSummary(value),clock);
  const chase = input('Não esquece de mim! Algum retorno?', 5);
  const general = chat([input('Olá', 9)]);
  const replied = chat([chase, out({status:'accepted', actor:'atendente', deliveryStatus:'delivered'})]);
  const pending = chat([chase, out({status:'accepted', deliveryStatus:'failed'})]);
  assert.equal(cq(pending).deliveryIssue,'failed');
  assert.equal(cq(pending).followUp,true);
  assert.equal(cq(replied).followUp,false);
  assert.equal(cq(replied).deliveryIssue,null);
  assert.equal(cq(chat([input('Obrigado!')])).followUp,false);
  assert.equal(cq(chat([input('Ainda sem retorno?', 1500)])).followUp,false);
  assert.equal(cq(chat([out({status:'unknown'})])).deliveryIssue,'uncertain');
  assert.equal(cq(chat([out({status:'accepted'})])).deliveryIssue,null);
  assert.equal(cq(chat([out({status:'processing'})])).deliveryIssue,'uncertain');
  assert.equal(cq(chat([out({status:'processing',at:ago(1)})])).deliveryIssue,null);
  assert.equal(cq({...pending,stage:'Concluído'}).deliveryIssue,null);
  assert.deepEqual(sortChatQueue([general,pending],clock), [pending,general]);
  assert.equal('pendingDeliveryReceipts' in chatQueueSummary({...pending,pendingDeliveryReceipts:[delivered('internal-id')]}),false);
});
