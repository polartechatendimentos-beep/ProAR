import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import "./globals.css";
import "./proar-unified-layout.css";
import "./global-feedback.css";
import "./experience-design.css";
import "./tender-radar-design.css";
import {SystemAppearance} from "@/components/SystemAppearance";
import { GlobalFeedback } from "@/components/GlobalFeedback";

const geistSans = Inter({
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
  manifest: "/manifest-system.webmanifest",
  icons: {
    icon: "/brand/proar-system-32.png?v=20261015",
    shortcut: "/brand/proar-system-192.png?v=20261015",
    apple: "/brand/proar-system-180.png?v=20261015",
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
        <SystemAppearance />
      </body>
    </html>
  );
}
