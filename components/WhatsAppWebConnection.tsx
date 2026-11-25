"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Connection = { configured?: boolean; needsProvisioning?: boolean; state?: "open" | "connecting" | "close"; qr?: string; error?: string; automationEnabled?: boolean; automationAvailable?: boolean };

export function WhatsAppWebConnection({ companyId }: { companyId: string }) {
  const [connection, setConnection] = useState<Connection | null>(null);
  const [busy, setBusy] = useState(false);
  const [testNumber, setTestNumber] = useState("");
  const [testMessage, setTestMessage] = useState("");
  const testRequestId = useRef<string | null>(null);
  const [history, setHistory] = useState<{ status: string; recipient: string; createdAt: string; error?: string }[]>([]);

  async function loadHistory() {
    try {
      const response = await fetch("/api/whatsapp/web/history", { cache: "no-store", headers: { "X-Proar-Company-ID": companyId } });
      if (!response.ok) throw new Error();
      const data = await response.json();
      setHistory(data.items || []);
    } catch { setConnection(previous => ({ ...previous, error: "Não foi possível carregar o histórico de envios." })); }
  }

  const refresh = useCallback(async (pair = false, quiet = false) => {
    if (!quiet) setBusy(true);
    try {
      const response = await fetch("/api/whatsapp/web", { method: pair ? "POST" : "GET", cache: "no-store", headers: { "X-Proar-Company-ID": companyId } });
      const data: Connection = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível consultar a conexão.");
      setConnection(previous => ({
        ...data,
        qr: data.qr || (!pair && data.state === "connecting" ? previous?.qr : undefined),
      }));
    } catch (error) {
      setConnection(previous => ({ ...previous, error: error instanceof Error ? error.message : "Falha ao consultar o WhatsApp Web." }));
    } finally {
      if (!quiet) setBusy(false);
    }
  }, [companyId]);

  async function toggleAutomation() {
    setBusy(true);
    try {
      const response = await fetch("/api/whatsapp/web", { method: "PUT", headers: { "Content-Type": "application/json", "X-Proar-Company-ID": companyId }, body: JSON.stringify({ automationEnabled: !connection?.automationEnabled }) });
      const data: Connection = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível salvar os envios automáticos.");
      setConnection(previous => ({ ...previous, ...data }));
    } catch (error) { setConnection(previous => ({ ...previous, error: error instanceof Error ? error.message : "Não foi possível salvar os envios automáticos." })); }
    finally { setBusy(false); }
  }

  async function sendTest() {
    setBusy(true);
    testRequestId.current ||= crypto.randomUUID();
    try {
      const response = await fetch("/api/whatsapp/web/test", { method: "POST", headers: { "Content-Type": "application/json", "X-Proar-Company-ID": companyId }, body: JSON.stringify({ to: testNumber, requestId: testRequestId.current }) });
      const data = await response.json();
      setTestMessage(data.status === "accepted" ? "Mensagem de teste aceita pelo servidor. Confira o recebimento no WhatsApp." : data.status === "duplicate" ? "Este teste já foi registrado. Confira o histórico." : data.status === "disconnected" ? "WhatsApp desconectado. Conecte o aparelho para testar." : data.status === "blocked-optout" ? "Esse destinatário solicitou a interrupção das mensagens." : data.error || "Envio sem confirmação. Confira o histórico antes de repetir.");
      await loadHistory();
    } catch { setTestMessage("Teste sem confirmação. Confira o histórico antes de repetir."); }
    finally { setBusy(false); }
  }

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    if (connection?.state !== "connecting") return;
    const timer = window.setInterval(() => void refresh(false, true), 4000);
    return () => window.clearInterval(timer);
  }, [connection?.state, refresh]);

  useEffect(() => {
    if (!connection?.qr) return;
    const timeout = window.setTimeout(() => setConnection(previous => previous ? { ...previous, qr: undefined } : null), 45000);
    return () => window.clearTimeout(timeout);
  }, [connection?.qr]);

  return <div className="settings-form whatsapp-settings-form">
    <div className="wide">
      <div className="connection-actions">
      <h4>NexoCloud • WhatsApp Web por QR Code</h4>
      <p>O servidor Evolution API da NexoCloud mantém uma instância separada para esta empresa. Leia o QR Code com o número que ela usará; outras empresas não compartilham a conexão.</p>
      <p role="status" className={connection?.state === "open" ? "connection-status is-connected" : "connection-status"}>{connection?.state === "open" && <span className="connection-badge">Conectado</span>}{connection?.error || (connection?.state === "open" ? "WhatsApp conectado" :
        connection?.state === "connecting" ? "Aguardando pareamento" :
        connection?.needsProvisioning ? "Pronto para conectar o WhatsApp da empresa." :
        connection?.state === "close" ? "WhatsApp desconectado" :
        connection?.configured === false ? "A conexão aguarda a configuração segura do servidor Evolution API da NexoCloud pela gestão do ProAR." : "Consultando a conexão desta empresa…")}</p>
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
        <p>Lembretes e rotinas de envio automático desta empresa: {connection.automationEnabled ? "ativados" : "desativados"}.</p>
        {connection.automationAvailable === false && <p role="note">O administrador do ProAR ainda precisa habilitar o serviço geral de automação.</p>}
        <button type="button" className="secondary-btn" disabled={busy || (!connection.automationEnabled && (connection.state !== "open" || connection.automationAvailable !== true))} onClick={() => void toggleAutomation()}>{connection.automationEnabled ? "Desativar envios automáticos" : "Ativar envios automáticos"}</button>
      </div>}
      {connection?.configured && <div>
        {connection.state === "open" && <div>
          <label>Número autorizado para receber o teste<input type="tel" maxLength={25} value={testNumber} placeholder="(17) 99999-9999" onChange={event => { setTestNumber(event.target.value); testRequestId.current = null; setTestMessage(""); }}/></label>
          <button type="button" className="secondary-btn" disabled={busy || !testNumber.trim()} onClick={() => void sendTest()}>Enviar mensagem de teste</button>
          <p role="status">{testMessage}</p>
        </div>}
        <button type="button" className="secondary-btn" disabled={busy} onClick={() => void loadHistory()}>Atualizar histórico de envios</button>
        <ul>{history.map((item, index) => <li key={`${item.createdAt}-${index}`}>
          {new Date(item.createdAt).toLocaleString("pt-BR")} • {item.recipient} • {item.status === "accepted" ? "Aceito pelo servidor" : item.status === "processing" ? "Em processamento; conferir antes de reenviar" : item.status === "blocked-optout" ? "Bloqueado por pedido do cliente" : "Aguardando conferência"}{item.error ? ` • ${item.error}` : ""}
        </li>)}</ul>
      </div>}
      </div>
    </div>
  </div>;
}

