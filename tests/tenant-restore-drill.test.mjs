import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { projectOperationalState, mergeOperationalView } from "../lib/state-access.ts";
import { tenantEmployeeCandidate } from "../lib/tenant-employee-auth.ts";
import { sessionCompany } from "../lib/permissions.ts";
import { tenantIdentity } from "../lib/tenant-identity.ts";

const tenant = tag => ({
  _companyId: `homolog-${tag}`, _revision: 3,
  customers: [{ id: "CLI-1", name: `Cliente sintético ${tag}` }],
  serviceOrders: [
    { id: "OS-1", client: `Cliente sintético ${tag}`, tech: "Técnico Sintético", customerId: "CLI-1", total: 100, diagnosis: `Marcador ${tag}` },
    { id: "OS-2", client: `Cliente sintético ${tag}`, tech: "Outro técnico", customerId: "CLI-1", total: 1000 },
  ],
  moduleRecords: {
    Financeiro: [{ id: "FIN-1", value: 100, name: `Financeiro ${tag}` }],
    "Funcionários": [{ id: "F-1", name: "Técnico Sintético", employeeUsername: "mesmo-login", employeePasswordHash: `fake-${tag}` }],
  },
});
const digest = bytes => createHash("sha256").update(bytes).digest("hex");
const bytesOf = json => JSON.stringify(json);
const admin = { username: "admin", displayName: "Administrador", role: "Administrador", permissions: ["*"] };
const technician = { username: "mesmo-login", displayName: "Técnico Sintético", role: "Técnico de Campo", permissions: [] };

test("fixture B remains unchanged while A is restored only into a fresh destination and tested under admin and staff scope", () => {
  const a = tenant("a"), b = tenant("b");
  const beforeB = digest(bytesOf(b));
  assert.notEqual(
    tenantIdentity({ companyId: a._companyId, slug: "homolog-a" }).databaseName,
    tenantIdentity({ companyId: b._companyId, slug: "homolog-b" }).databaseName,
  );
  // Two positives are the controls: equal business IDs in distinct tenants
  // must still resolve to each tenant's own records.
  for (const source of [a,b]) {
    assert.equal(sessionCompany({ ...admin, companyId: source._companyId }, source._companyId).ok,true);
    const projection = projectOperationalState(source,admin,() => true);
    assert.equal(projection.serviceOrders[0].diagnosis, source.serviceOrders[0].diagnosis);
    assert.equal(projection.moduleRecords["Funcionários"][0].employeePasswordHash,undefined);
  }
  assert.equal(sessionCompany({ ...admin, companyId: a._companyId }, b._companyId).ok,false);
  assert.equal(sessionCompany({ ...admin, companyId: b._companyId }, a._companyId).ok,false);
  assert.equal(tenantEmployeeCandidate(b,a._companyId,"mesmo-login"),null);
  assert.equal(tenantEmployeeCandidate(a,b._companyId,"mesmo-login"),null);
  assert.equal(tenantEmployeeCandidate(a,a._companyId,"mesmo-login").id,"F-1");
  assert.equal(tenantEmployeeCandidate(b,b._companyId,"mesmo-login").id,"F-1");
  const snapshot = bytesOf(a), checksum = digest(snapshot);
  a.serviceOrders[0].diagnosis = "Alterado depois do snapshot";
  const restoredA = JSON.parse(snapshot);
  assert.equal(restoredA._companyId,a._companyId);
  assert.equal(digest(bytesOf(restoredA)),checksum);
  assert.equal(restoredA.serviceOrders[0].diagnosis,"Marcador a");
  assert.equal(restoredA.customers[0].id,restoredA.serviceOrders[0].customerId);
  assert.equal(a.serviceOrders[0].diagnosis,"Alterado depois do snapshot");

  const allowed = permission => ["os.visualizar","os.editar"].includes(permission);
  const limited = projectOperationalState(restoredA, technician, allowed);
  assert.deepEqual(limited.serviceOrders.map(row=>row.id), ["OS-1"]);
  assert.equal(limited.serviceOrders[0].total, undefined);
  assert.equal(limited.moduleRecords.Financeiro, undefined);
  assert.equal(limited.moduleRecords["Funcionários"], undefined);
  limited.serviceOrders[0].diagnosis = "Alteração de conferência no destino restaurado";
  const merged = mergeOperationalView(restoredA,limited,technician,allowed);
  assert.equal(merged.serviceOrders.find(row=>row.id==="OS-1").diagnosis,"Alteração de conferência no destino restaurado");
  assert.deepEqual(merged.serviceOrders.find(row=>row.id==="OS-2"),restoredA.serviceOrders.find(row=>row.id==="OS-2"));
  assert.deepEqual(merged.moduleRecords.Financeiro,restoredA.moduleRecords.Financeiro);
  assert.equal(digest(bytesOf(b)),beforeB);
});
