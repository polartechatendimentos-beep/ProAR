import { ProARMobile } from "@/components/ProARMobile";

export const metadata = {
  manifest: "/manifest.webmanifest",
  icons: { icon: "/brand/proar-mobile-32.png?v=20261015", apple: "/brand/proar-mobile-180.png?v=20261015" },
  title: "ProAR Mobile | Operação em Campo",
  description: "Agenda e ordens de serviço da equipe de campo integradas ao ProAR",
};

export default function MobilePage() {
  return <ProARMobile />;
}
