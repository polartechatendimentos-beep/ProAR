import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ProAR - Gestão Autônoma de Licitações & Fiscal",
  description: "Plataforma de monitoramento de licitações, gestão fiscal e alertas automatizados via WhatsApp",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
