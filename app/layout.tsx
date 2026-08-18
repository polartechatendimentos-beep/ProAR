import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ProAR Gestão de Serviços — BY TAV's",
  description: "ProAR Gestão de Serviços — BY TAV's | Sistema de Gestão Operacional, Comercial e Financeira.",
  icons: {
    icon: "/icon.png?v=20260818",
    shortcut: "/icon.png?v=20260818",
    apple: "/icon.png?v=20260818",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
