import { createHmac, randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { supabaseConfigured, supabaseRest } from "../../../../lib/supabase-rest";
import { provisionTenant } from "../../../../lib/tenant-provisioning";
import { resolveTenantDb, tenantHeaders } from "../../../../lib/tenant-rest";
import { hashPassword } from "../../../../lib/password";
import { companyUrl, isReservedSlug } from "../../../../lib/tenant-host";

const digits = (value: unknown) => String(value ?? "").replace(/\D/g, "");
const clean = (value: unknown, max = 180) => String(value ?? "").trim().slice(0, max);
const slugify = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 42);
const privacyHash = (value: string) => createHmac("sha256", process.env.PROAR_TRIAL_RATE_SECRET || process.env.PROAR_SESSION_SECRET || "proar").update(value).digest("hex");

async function verifyCaptcha(token: string, ip: string) {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  if (!secret) return true;
  if (!token) return false;
  const body = new URLSearchParams({ secret, response: token });
  if (ip) body.set("remoteip", ip);
  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body, cache: "no-store" });
  const result = response.ok ? await response.json() : null;
  return Boolean(result?.success);
}

function validCpf(cpf: string) {
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1+$/.test(cpf)) return false;
  const calc = (size: number) => { let sum = 0; for (let i = 0; i < size; i += 1) sum += Number(cpf[i]) * (size + 1 - i); const mod = (sum * 10) % 11; return mod === 10 ? 0 : mod; };
  return calc(9) === Number(cpf[9]) && calc(10) === Number(cpf[10]);
}
function validCnpj(cnpj: string) {
  if (!/^\d{14}$/.test(cnpj) || /^(\d)\1+$/.test(cnpj)) return false;
  const calc = (base: string) => { const weights = base.length === 12 ? [5,4,3,2,9,8,7,6,5,4,3,2] : [6,5,4,3,2,9,8,7,6,5,4,3,2]; const total = base.split("").reduce((sum,n,i)=>sum+Number(n)*weights[i],0); const mod=total%11; return mod<2?0:11-mod; };
  const d1 = calc(cnpj.slice(0,12)); const d2 = calc(cnpj.slice(0,12)+d1); return cnpj.endsWith(`${d1}${d2}`);
}

export async function POST(request: NextRequest) {
  if (!supabaseConfigured()) return NextResponse.json({ error: "Banco mestre do ProAR Manager não configurado." }, { status: 503 });
  const body = await request.json();
  if (String(body.website || "").trim()) return NextResponse.json({ error: "Cadastro inválido." }, { status: 400 });
  const ip = (request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown").split(",")[0].trim();
  const ipHash = privacyHash(ip);
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const attemptsResponse = await supabaseRest(`proar_trial_attempts?select=id&ip_hash=eq.${encodeURIComponent(ipHash)}&created_at=gte.${encodeURIComponent(since)}`);
  const attempts = attemptsResponse.ok ? await attemptsResponse.json() : [];
  if (Array.isArray(attempts) && attempts.length >= 5) return NextResponse.json({ error: "Limite de cadastros de teste atingido. Tente novamente mais tarde ou fale com o comercial." }, { status: 429 });
  if (!(await verifyCaptcha(clean(body.captchaToken, 2048), ip === "unknown" ? "" : ip))) return NextResponse.json({ error: "Não foi possível validar a verificação anti-robô." }, { status: 400 });
  if (body.acceptTerms !== true || body.acceptPrivacy !== true) return NextResponse.json({ error: "É necessário aceitar os Termos de Uso e a Política de Privacidade." }, { status: 400 });

  const personType = body.personType === "PF" ? "PF" : "PJ";
  const document = digits(body.document);
  if (personType === "PJ" ? !validCnpj(document) : !validCpf(document)) return NextResponse.json({ error: `${personType === "PJ" ? "CNPJ" : "CPF"} inválido.` }, { status: 400 });
  const email = clean(body.email, 160).toLowerCase();
  const phone = digits(body.phone).slice(0, 13);
  const legalName = clean(body.legalName || body.tradeName || body.responsibleName);
  const tradeName = clean(body.tradeName || legalName);
  if (!legalName || !email || phone.length < 10) return NextResponse.json({ error: "Informe nome/razão social, e-mail e telefone válidos." }, { status: 400 });

  const duplicateFilters = [personType === "PJ" ? `cnpj.eq.${document}` : `cpf.eq.${document}`, `email.eq.${email}`, `phone.eq.${phone}`];
  const duplicate = await supabaseRest(`proar_companies?select=id,trial_started_at,status&or=(${duplicateFilters.map(encodeURIComponent).join(",")})&limit=1`);
  if (duplicate.ok && (await duplicate.json()).length) return NextResponse.json({ error: "Este CPF/CNPJ, e-mail ou telefone já possui cadastro ou já utilizou o teste gratuito." }, { status: 409 });
  await supabaseRest("proar_trial_attempts", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ ip_hash: ipHash, document_hash: privacyHash(document), email }) });

  let slug = slugify(tradeName) || `empresa-${document.slice(-6)}`;
  if (isReservedSlug(slug)) slug = `${slug}-empresa`;
  const slugCheck = await supabaseRest(`proar_companies?select=id&slug=eq.${encodeURIComponent(slug)}&limit=1`);
  if (slugCheck.ok && (await slugCheck.json()).length) slug = `${slug}-${document.slice(-5)}`;
  if (isReservedSlug(slug)) slug = `empresa-${document.slice(-6)}`;

  const now = new Date();
  const expires = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const companyId = personType === "PJ" ? document : `pf-${document}`;
  const company = {
    id: companyId,
    cnpj: personType === "PJ" ? document : null,
    cpf: personType === "PF" ? document : null,
    person_type: personType,
    legal_name: legalName,
    trade_name: tradeName,
    responsible_name: clean(body.responsibleName || legalName),
    city: clean(body.city, 100), state: clean(body.state, 2).toUpperCase() || "SP",
    phone, whatsapp: digits(body.whatsapp || body.phone).slice(0, 13), email,
    zip_code: digits(body.zipCode).slice(0, 8), street: clean(body.street), address_number: clean(body.addressNumber, 20), complement: clean(body.complement, 100), neighborhood: clean(body.neighborhood, 100),
    address: clean([body.street, body.addressNumber, body.neighborhood, body.city, body.state].filter(Boolean).join(", "), 260),
    state_registration: clean(body.stateRegistration, 40), municipal_registration: clean(body.municipalRegistration, 40), company_type: clean(body.companyType, 60), tax_regime: clean(body.taxRegime, 60), segment: clean(body.segment, 80),
    slug, plan_code: "trial", trial_started_at: now.toISOString(), trial_expires_at: expires.toISOString(), status: "active",
    brand_config: { systemName: "ProAR Gestão de Serviços", developer: "BY TAV's", tagline: "Sistema de Gestão Operacional, Comercial e Financeira", logo: "", primaryColor: "#0b5ea8" },
    updated_at: now.toISOString(),
  };
  const inserted = await supabaseRest("proar_companies", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify(company) });
  if (!inserted.ok) return NextResponse.json({ error: "Não foi possível criar a empresa no ProAR Manager." }, { status: 502 });

  const configuredDefault = process.env.PROAR_TRIAL_DEFAULT_PASSWORD?.trim();
  const temporaryPassword = configuredDefault || `ProAR@${randomBytes(4).toString("hex")}`;
  const passwordHash = hashPassword(temporaryPassword);
  const trialUser = await supabaseRest("proar_trial_users", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ company_id: companyId, username: "admin", display_name: clean(body.responsibleName || "Administrador"), password_hash: passwordHash, role: "Administrador", permissions: ["*"], active: true, must_change_password: true }) });
  if (!trialUser.ok) {
    // Não deixar cadastro órfão bloqueando um novo trial.
    await supabaseRest(`proar_companies?id=eq.${encodeURIComponent(companyId)}`, { method: "DELETE", headers: { Prefer: "return=minimal" } }).catch(() => null);
    return NextResponse.json({ error: "Não foi possível concluir a criação do administrador. Nenhum ambiente de teste foi ativado." }, { status: 502 });
  }

  let provisioning: { mode: string; projectRef?: string; apiUrl?: string; error?: string } = { mode: "manual" };
  try { provisioning = await provisionTenant({ id: companyId, slug, tradeName }); }
  catch (error) { provisioning = { mode: "error", error: error instanceof Error ? error.message : "Falha no provisionamento automático." }; }

  if (body.demoData === true) {
    try {
      const db = await resolveTenantDb(companyId);
      if (db.url && db.key) {
        const id = db.dedicated ? "main" : companyId;
        const demoPayload = { customers: [{ id: "CLI-DEMO", name: "Cliente Demonstração", doc: "", contact: "Responsável Demo", phone: "(17) 99999-0000", address: "Endereço de demonstração", units: 1, status: "Ativo" }], serviceOrders: [{ id: "OS-DEMO-001", client: "Cliente Demonstração", unit: "Matriz", service: "Higienização demonstrativa", tech: "Administrador", date: new Date().toISOString().slice(0,10), time: "09:00", address: "Endereço de demonstração", status: "Agendada", tone: "blue", avatar: "AD" }], moduleRecords: { Serviços: [{ id: "SRV-DEMO", name: "Higienização demonstrativa", client: "", description: "DADO DE DEMONSTRAÇÃO", createdAt: new Date().toISOString(), kind: "Serviço", status: "Ativo", value: 250 }], Produtos: [{ id: "PRD-DEMO", name: "Produto Demonstração", client: "", description: "DADO DE DEMONSTRAÇÃO", createdAt: new Date().toISOString(), kind: "Produto", status: "Ativo", value: 100 }] }, _revision: 1, _updatedAt: new Date().toISOString(), _demoData: true };
        await fetch(`${db.url}/rest/v1/proar_state?on_conflict=id`, { method: "POST", headers: { ...tenantHeaders(db.key), Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ id, payload: demoPayload, updated_at: new Date().toISOString() }) });
      }
    } catch {}
  }

  await supabaseRest("proar_manager_audit", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ company_id: companyId, action: "TRIAL_CREATED", actor: email, details: { slug, expiresAt: expires.toISOString(), provisioning: provisioning.mode } }) });

  return NextResponse.json({ created: true, companyId, slug, username: "admin", temporaryPassword, mustChangePassword: true, trialExpiresAt: expires.toISOString(), accessUrl: companyUrl(slug), provisioning });
}
