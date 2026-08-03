export interface WhatsAppMessage {
  to: string;
  message: string;
}

export async function sendWhatsAppNotification({ to, message }: WhatsAppMessage) {
  const apiUrl = process.env.WHATSAPP_API_URL;
  const token = process.env.WHATSAPP_API_TOKEN;

  if (!apiUrl || !token) {
    console.log(`[WhatsApp Mock] Para: ${to} | Mensagem: ${message}`);
    return { success: true, mock: true };
  }

  try {
    const res = await fetch(`${apiUrl}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: message },
      }),
    });

    const data = await res.json();
    return { success: res.ok, data };
  } catch (error) {
    console.error("Erro ao enviar mensagem no WhatsApp:", error);
    return { success: false, error };
  }
}
