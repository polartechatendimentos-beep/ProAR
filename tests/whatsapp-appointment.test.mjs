import { test } from "node:test";
import assert from "node:assert/strict";
import { appointmentDue } from "../lib/whatsapp-appointment.ts";

test("lembrete respeita horário de São Paulo, consentimento e data vigente", () => {
  const now = new Date("2026-11-05T12:00:00Z");
  const order = { date: "2026-11-06", time: "09:00", status: "Aberta", whatsappAutomaticConsent: true };
  assert.equal(appointmentDue(order, now), true);
  assert.equal(appointmentDue({ ...order, time: "10:00" }, now), false);
  assert.equal(appointmentDue({ ...order, whatsappAutomaticConsent: undefined }, now), false);
  assert.equal(appointmentDue({ ...order, status: "Cancelada" }, now), false);
  assert.equal(appointmentDue({ ...order, whatsappAppointmentReminderEnabled: false }, now), false);
});
