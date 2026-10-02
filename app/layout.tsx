import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "./proar-unified-layout.css";
import "./global-feedback.css";
import { GlobalFeedback } from "@/components/GlobalFeedback";

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
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/icon-512.png",
    shortcut: "/icon-192.png",
    apple: "/icon-192.png",
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
        <GlobalFeedback />
      </body>
    </html>
  );
}
