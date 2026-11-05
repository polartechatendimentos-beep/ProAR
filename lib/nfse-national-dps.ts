const digits = (value: string, length: number) => {
  if (!new RegExp("^\\d{" + length + "}$").test(value)) throw new Error("Identificação fiscal inválida.");
  return value;
};
const escapeXml = (value: string) => value.replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&apos;" })[c]!);
export type NationalOrder = {
  id: string; customerDocument: string; description: string; cents: number;
  serviceCode: string; serviceCity: string; competence: string;
  retention: "1" | "2" | "3"; taxProfileId: string;
};
export function groupNationalOrders(orders: NationalOrder[]) {
  if (!orders.length || orders.length > 100) throw new Error("Selecione entre 1 e 100 OS.");
  const ids = new Set<string>(), groups = new Map<string, NationalOrder[]>();
  for (const order of orders) {
    if (!order.id || ids.has(order.id)) throw new Error("OS repetida ou inválida.");
    ids.add(order.id);
    if (!/^(\d{11}|\d{14})$/.test(order.customerDocument) || !Number.isSafeInteger(order.cents) || order.cents <= 0 ||
      !order.description.trim() || !order.taxProfileId || !["1","2","3"].includes(order.retention)) throw new Error("Dados fiscais incompletos na OS " + order.id);
    digits(order.serviceCode, 6); digits(order.serviceCity, 7);
    const date = new Date(order.competence);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(order.competence) || !Number.isFinite(+date) || date.toISOString().slice(0,10) !== order.competence) throw new Error("Competência inválida.");
    const key = JSON.stringify([order.customerDocument,order.serviceCode,order.serviceCity,order.competence,order.retention,order.taxProfileId]);
    groups.set(key,[...(groups.get(key) || []),order]);
  }
  return [...groups.values()].map(rows => {
    const cents = rows.reduce((sum,row) => sum + row.cents,0);
    if (!Number.isSafeInteger(cents) || cents > 999999999999999) throw new Error("Total fiscal fora do limite.");
    const description = rows.map(row => row.id + ": " + row.description.trim()).join("; ");
    if (description.length > 2000 || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(description)) throw new Error("Descrição fiscal inválida; divida o grupo.");
    return { orders: rows, cents, description };
  });
}
export function nationalDpsId(city: string, cnpj: string, series: string, number: string) {
  if (!/^\d{1,5}$/.test(series) || !/^[1-9]\d{0,14}$/.test(number)) throw new Error("Série ou número da DPS inválido.");
  return "DPS" + digits(city,7) + "2" + digits(cnpj,14) + series.padStart(5,"0") + number.padStart(15,"0");
}
// Fragment only: the complete DPS still requires the provider/taker, tax groups and XMLDSIG.
export function nationalServiceFragment(orders: NationalOrder[]) {
  const groups = groupNationalOrders(orders);
  if (groups.length !== 1) throw new Error("As OS não podem integrar a mesma DPS.");
  const {orders: rows, cents, description} = groups[0];
  const {serviceCity, serviceCode} = rows[0];
  return { serviceXml: "<serv><locPrest><cLocPrestacao>" + serviceCity + "</cLocPrestacao></locPrest><cServ><cTribNac>" + serviceCode + "</cTribNac><xDescServ>" + escapeXml(description) + "</xDescServ></cServ></serv>", value: (cents / 100).toFixed(2) };
}
