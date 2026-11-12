"use client";

import { useEffect, useState } from "react";

type Connection = { configured?: boolean; needsProvisioning?: boolean; state?: "open" | "connecting" | "close"; qr?: string; error?: string; automationEnabled?: boolean; automationAvailable?: boolean };

export function WhatsAppWebConnection({ companyId }: { companyId: string }) {
  const [connection, setConnection] = useState<Connection | null>(null);
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<{ status: string; recipient: string; createdAt: string; error?: string }[]>([]);

  async function loadHistory() {
    try {
      const response = await fetch("/api/whatsapp/web/history", { cache: "no-store", headers: { "X-Proar-Company-ID": companyId } });
      if (!response.ok) throw new Error();
      const data = await response.json();
      setHistory(data.items || []);
    } catch { setConnection(previous => ({ ...previous, error: "Não foi possível carregar o histórico de envios." })); }
  }

  async function refresh(pair = false) {
    setBusy(true);
    try {
      const response = await fetch("/api/whatsapp/web", { method: pair ? "POST" : "GET", cache: "no-store", headers: { "X-Proar-Company-ID": companyId } });
      const data: Connection = await response.json();
      setConnection(previous => ({
        ...data,
        qr: data.qr || (!pair && data.state === "connecting" ? previous?.qr : undefined),
      }));
    } catch {
      setConnection({ error: "Falha ao consultar o WhatsApp Web." });
    } finally {
      setBusy(false);
    }
  }

  async function toggleAutomation() {
    setBusy(true);
    try {
      const response = await fetch("/api/whatsapp/web", { method: "PUT", headers: { "Content-Type": "application/json", "X-Proar-Company-ID": companyId }, body: JSON.stringify({ automationEnabled: !connection?.automationEnabled }) });
      const data: Connection = await response.json();
      setConnection(previous => ({ ...previous, ...data }));
    } catch { setConnection(previous => ({ ...previous, error: "Não foi possível salvar os envios automáticos." })); }
    finally { setBusy(false); }
  }

  useEffect(() => {
    if (!connection?.qr) return;
    const timeout = window.setTimeout(() => setConnection(previous => previous ? { ...previous, qr: undefined } : null), 45000);
    let active = true;
    const controller = new AbortController();
    async function checkPairing() {
      try {
        const response = await fetch("/api/whatsapp/web", { cache: "no-store", signal: controller.signal, headers: { "X-Proar-Company-ID": companyId } });
        if (!response.ok) return;
        const data: Connection = await response.json();
        if (active && data.state === "open") setConnection(data);
      } catch {
        // The operator can consult the connection manually after a transient failure.
      } finally {
        if (active) timer = window.setTimeout(checkPairing, 4000);
      }
    }
    let timer = window.setTimeout(checkPairing, 4000);
    return () => {
      active = false;
      controller.abort();
      window.clearTimeout(timer);
      window.clearTimeout(timeout);
    };
  }, [connection?.qr, companyId]);

  return <div className="settings-form whatsapp-settings-form">
    <div className="wide">
      <h4>WhatsApp Web por QR Code</h4>
      <p>Conecte o WhatsApp desta empresa. Cada empresa usa seu próprio número e QR Code.</p>
      <p role="status">{connection?.error || (connection?.state === "open" ? "WhatsApp conectado" :
        connection?.state === "connecting" ? "Aguardando pareamento" :
        connection?.needsProvisioning ? "Pronto para conectar o WhatsApp da empresa." :
        connection?.state === "close" ? "WhatsApp desconectado" :
        connection?.configured === false ? "Instância indisponível para esta conta." : "Consulte a conexão para começar.")}</p>
      {connection?.qr && <div>
        <p>No celular, abra Aparelhos conectados e escolha Conectar um aparelho.</p>
        {/* The QR comes from the paired server and expires shortly. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={connection.qr} alt="QR Code para parear o WhatsApp" width={240} height={240}/>
      </div>}
      <button type="button" className="secondary-btn" disabled={busy} onClick={() => void refresh()}>Consultar conexão</button>
      {connection?.configured && connection.state !== "open" &&
        <button type="button" className="primary-btn" disabled={busy} onClick={() => void refresh(true)}>Gerar QR Code</button>}
      {connection?.configured && !connection.needsProvisioning && <div>
        <p>Envios automáticos: {connection.automationEnabled ? "ativados para esta empresa" : "desativados"}.</p>
        {connection.automationAvailable === false && <p>A ativação geral aguarda a conclusão dos testes de integração.</p>}
        <button type="button" className="secondary-btn" disabled={busy || (!connection.automationEnabled && connection.state !== "open")} onClick={() => void toggleAutomation()}>{connection.automationEnabled ? "Desativar envios automáticos" : "Ativar envios automáticos"}</button>
      </div>}
      {connection?.configured && <div>
        <button type="button" className="secondary-btn" disabled={busy} onClick={() => void loadHistory()}>Atualizar histórico de envios</button>
        <ul>{history.map((item, index) => <li key={`${item.createdAt}-${index}`}>
          {new Date(item.createdAt).toLocaleString("pt-BR")} • {item.recipient} • {item.status === "accepted" ? "Aceito pelo servidor" : item.status === "processing" ? "Em processamento; conferir antes de reenviar" : "Aguardando conferência"}{item.error ? ` • ${item.error}` : ""}
        </li>)}</ul>
      </div>}
    </div>
  </div>;
}
