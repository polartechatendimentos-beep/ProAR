import type { FieldOrderCommand } from "./mobile-workday";
export type PendingOrderSubmission = {
  command: FieldOrderCommand;
  queuedAt: number;
  sentAt?: number;
  blocked?: boolean;
  error?: string;
};
/** A retry always uses the same persisted command, including its idempotency key. */
export function queueOrderSubmission(command: FieldOrderCommand, now = Date.now()): PendingOrderSubmission {
  return {command: JSON.parse(JSON.stringify(command)) as FieldOrderCommand, queuedAt: now};
}
export function orderSubmissionFailure(pending: PendingOrderSubmission, message: string, status?: number): PendingOrderSubmission {
  return {...pending, error: message, blocked: status !== undefined && status >= 400 && status < 500 && status !== 408 && status !== 429};
}
export function orderSubmissionConfirmed(pending: PendingOrderSubmission, result: {saved?:boolean; orderId?:string; completedAt?:string|null; status?:string}) {
  return result.saved === true && result.orderId === pending.command.orderId && (pending.command.action !== "finish" || Boolean(result.completedAt && /conclu[ií]d|finalizad|encerrad/i.test(result.status || "")));
}
