/** A provider ACK is not the same as delivery to the recipient's device. */
export type DeliveryStatus = "failed" | "delivered" | "read";
export type DeliveryReceipt = { providerMessageId: string; deliveryStatus: DeliveryStatus };
export type PendingDeliveryReceipt = DeliveryReceipt & { at: number };

type DeliveryMessage = { id: string; direction: string; status?: string; at: string; providerMessageId?: string; deliveryStatus?: DeliveryStatus };
type DeliveryConversation = { messages: DeliveryMessage[]; pendingDeliveryReceipts?: PendingDeliveryReceipt[] };

const rank: Record<DeliveryStatus, number> = { failed: 1, delivered: 2, read: 3 };
const receiptWindow = 5 * 60_000;
const strongest = (current: DeliveryStatus | undefined, next: DeliveryStatus) =>
  !current || rank[next] > rank[current] ? next : current;
const unexpired = (chat: DeliveryConversation, now: number) =>
  (chat.pendingDeliveryReceipts || []).filter(item => item.at >= now - receiptWindow);

export function applyChatDeliveryReceipt<T extends DeliveryConversation>(
  current: T | null,
  receipt: DeliveryReceipt,
  now = Date.now(),
): T | null {
  if (!current) return null;
  const index = current.messages.findIndex(message => message.direction === "out" && message.providerMessageId === receipt.providerMessageId);
  if (index >= 0) {
    const previous = current.messages[index].deliveryStatus;
    const deliveryStatus = strongest(previous, receipt.deliveryStatus);
    if (previous === deliveryStatus) return null;
    const messages = current.messages.slice();
    messages[index] = { ...messages[index], deliveryStatus };
    return { ...current, messages };
  }
  // A callback can win the race against the send response. Buffer only
  // while this exact conversation has a recent pending ProAR send.
  if (!current.messages.some(message => message.direction === "out" && message.status === "processing" && Date.parse(message.at) >= now - receiptWindow)) return null;
  const pending = unexpired(current, now);
  const existing = pending.find(item => item.providerMessageId === receipt.providerMessageId);
  const deliveryStatus = strongest(existing?.deliveryStatus, receipt.deliveryStatus);
  if (existing?.deliveryStatus === deliveryStatus) return null;
  return { ...current, pendingDeliveryReceipts: [...pending.filter(item => item.providerMessageId !== receipt.providerMessageId), { ...receipt, deliveryStatus, at: now }].slice(-16) };
}

export function completeChatSend<T extends DeliveryConversation>(
  current: T | null,
  id: string,
  status: string,
  providerMessageId?: string,
  now = Date.now(),
): T | null {
  if (!current) return null;
  const index = current.messages.findIndex(message => message.direction === "out" && message.id === id);
  if (index < 0) return null;
  const pending = unexpired(current, now);
  const receipt = providerMessageId ? pending.find(item => item.providerMessageId === providerMessageId) : undefined;
  const messages = current.messages.slice();
  const message = messages[index];
  messages[index] = { ...message, status, providerMessageId, deliveryStatus: receipt ? strongest(message.deliveryStatus, receipt.deliveryStatus) : message.deliveryStatus };
  return { ...current, messages, pendingDeliveryReceipts: pending.filter(item => item !== receipt) };
}
