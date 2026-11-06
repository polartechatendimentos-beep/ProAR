export function appointmentDue(order: Record<string, unknown>, now: Date) {
  if (order.whatsappAutomaticConsent !== true || order.whatsappAppointmentReminderEnabled === false ||
    /conclu[ií]d|cancelad/i.test(String(order.status)) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(String(order.date)) || !/^\d{2}:\d{2}$/.test(String(order.time))) return false;
  const visit = Date.parse(`${order.date}T${order.time}:00-03:00`);
  const hours = Number(order.appointmentReminderHours ?? 24);
  const remaining = visit - now.getTime();
  return [2, 24, 48].includes(hours) && remaining > 0 && remaining <= hours * 3600000 &&
    remaining > (hours * 60 - 60) * 60000;
}
