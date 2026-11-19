"use client";

type CompanyPrintProfile = {
  legalName?: string;
  tradeName?: string;
  cnpj?: string;
  stateRegistration?: string;
  municipalRegistration?: string;
  address?: string;
  zipCode?: string;
  city?: string;
  state?: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  logo?: string;
};

export function CompanyReportLetterhead({ company }: { company: CompanyPrintProfile }) {
  const companyName = company.legalName?.trim() || company.tradeName?.trim() || "Empresa";
  const logoSource = company.logo?.trim() || "/proar-logo.png";
  const address = [
    company.address?.trim(),
    company.zipCode?.trim() ? `CEP ${company.zipCode.trim()}` : "",
    [company.city?.trim(), company.state?.trim()].filter(Boolean).join("/")
  ].filter(Boolean).join(" • ");
  const registrations = [
    company.cnpj?.trim() ? `CNPJ ${company.cnpj.trim()}` : "",
    company.stateRegistration?.trim() ? `IE ${company.stateRegistration.trim()}` : "",
    company.municipalRegistration?.trim() ? `IM ${company.municipalRegistration.trim()}` : ""
  ].filter(Boolean).join(" • ");
  const contacts = [
    company.phone?.trim() ? `Tel. ${company.phone.trim()}` : "",
    company.whatsapp?.trim() ? `WhatsApp ${company.whatsapp.trim()}` : "",
    company.email?.trim()
  ].filter(Boolean).join(" | ");

  return <>
    <style jsx global>{`
      .proar-company-letterhead { display: none; }
      @page { size: A4; margin: 14mm 13mm 14mm; }
      @media print {
        html, body { background: #fff !important; color: #17365a !important; }
        body { margin: 0 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .app-shell { display: block !important; min-height: 0 !important; height: auto !important; background: #fff !important; }
        .proar-company-letterhead {
          display: flex !important; align-items: center; justify-content: space-between; gap: 8mm;
          width: 100%; min-height: 25mm; box-sizing: border-box; padding: 0 0 5mm; margin: 0 0 7mm;
          border-bottom: 1.2pt solid #35bce7; color: #17365a !important; background: #fff !important;
          page-break-inside: avoid; break-inside: avoid;
        }
        .proar-company-letterhead-logo { display: flex; align-items: center; justify-content: flex-start; flex: 0 0 36%; min-width: 0; }
        .proar-company-letterhead-logo img { display: block; max-width: 48mm; max-height: 23mm; object-fit: contain; object-position: left center; }
        .proar-company-letterhead-fallback { color: #17365a !important; font-size: 15pt; font-weight: 800; line-height: 1.1; }
        .proar-company-letterhead-data { display: grid; flex: 1; justify-items: end; gap: 1.2mm; min-width: 0; text-align: right; color: #17365a !important; font-family: Arial, sans-serif; }
        .proar-company-letterhead-data strong { color: #17365a !important; font-size: 9.5pt; font-weight: 800; line-height: 1.2; }
        .proar-company-letterhead-data small { color: #36516e !important; font-size: 7.2pt; line-height: 1.25; overflow-wrap: anywhere; }
        .proar-skip-link, [data-testid="proar-sidebar"], .topbar, .connectivity-banner,
        .app-shell > .main > footer, .app-shell > .main > .sync-progress,
        .app-shell > .main > .database-contingency, .appearance-control, .appearance-launcher,
        .toast-container, [role="status"].sync-progress { display: none !important; }
        .print-order-header { display: flex !important; align-items: center !important; justify-content: space-between !important; gap: 8mm !important; padding: 0 0 5mm !important; margin: 0 0 7mm !important; border-bottom: 1.2pt solid #35bce7 !important; background: #fff !important; color: #17365a !important; }
        .print-order-header img { display: block !important; max-width: 48mm !important; max-height: 23mm !important; object-fit: contain !important; object-position: left center !important; }
        .print-order-header > div { flex: 1 !important; text-align: right !important; color: #17365a !important; }
        .print-order-header > div span, .print-order-header > div h1, .print-order-header > div p { color: #17365a !important; }
        .app-shell > .main { display: block !important; width: 100% !important; min-width: 0 !important; max-width: none !important; margin: 0 !important; padding: 0 !important; background: #fff !important; color: #17365a !important; box-shadow: none !important; }
        .app-shell > .main > header { display: none !important; }
        .app-shell > .main > footer { display: none !important; }
        .app-shell:has([role="dialog"]) > .main { display: none !important; }
        .app-shell * { box-shadow: none !important; text-shadow: none !important; }
        .app-shell button, .app-shell .no-print, .app-shell [data-print-hidden="true"] { display: none !important; }
        .app-shell table { width: 100% !important; border-collapse: collapse !important; }
        .app-shell tr, .app-shell article, .app-shell figure { break-inside: avoid; page-break-inside: avoid; }
        .app-shell input, .app-shell select, .app-shell textarea { border-color: #a8bbcd !important; color: #17365a !important; background: #fff !important; }
      }
    `}</style>
    <header className="proar-company-letterhead" aria-label={`Papel timbrado de ${companyName}`}>
      <div className="proar-company-letterhead-logo">
        <img src={logoSource} alt={company.tradeName?.trim() || companyName} />
      </div>
      <div className="proar-company-letterhead-data">
        <strong>{companyName}</strong>
        {registrations && <small>{registrations}</small>}
        {address && <small>{address}</small>}
        {contacts && <small>{contacts}</small>}
      </div>
    </header>
  </>;
}
