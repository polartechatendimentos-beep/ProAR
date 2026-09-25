import type { Metadata } from "next";
import "./globals.css";
import "./unified-shell.css";
import { PwaRegister } from "@/components/PwaRegister";

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
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
