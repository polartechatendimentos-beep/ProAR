export type ProductImageDetails = { name?: string; description?: string; category?: string; catalogImage?: string };

// Drawings represent a category, never a brand, exact model or technical specification.
const images = {
  equipamento: ["Ar-condicionado", '<rect x="27" y="42" width="106" height="47" rx="12" fill="#f4fbff"/><path d="M39 73h82M42 81h75" stroke="#527e9b" stroke-width="4"/><circle cx="118" cy="60" r="4" fill="#22b8dd"/><path d="M53 98l-9 14m35-14v16m25-16l10 14" stroke="#9ce5ff" stroke-width="4"/>'],
  tubulacao: ["Tubulação de cobre", '<ellipse cx="81" cy="78" rx="51" ry="31" stroke="#fcb28c" stroke-width="10"/><ellipse cx="83" cy="78" rx="34" ry="20" stroke="#d78358" stroke-width="8"/><ellipse cx="83" cy="77" rx="19" ry="11" stroke="#f5c5a9" stroke-width="7"/><path d="M37 65Q30 46 17 49M124 86q14 11 17 18" stroke="#fcb28c" stroke-width="8"/>'],
  isolamento: ["Isolante térmico", '<path d="M46 95l43-55q11-13 26-2l12 9q11 10 2 22l-49 54Z" fill="#6e8da6"/><ellipse cx="62" cy="108" rx="25" ry="18" transform="rotate(28 62 108)" fill="#d2e5ef"/><ellipse cx="62" cy="108" rx="15" ry="10" transform="rotate(28 62 108)" fill="#263b50"/><path d="M89 44l28 20" stroke="#a7bccd" stroke-width="4"/>'],
  fluido: ["Fluido refrigerante", '<rect x="48" y="50" width="65" height="76" rx="19" fill="#78d2df"/><path d="M59 49V36h41v13M74 33v-8h13v8" stroke="#d8f6fc" stroke-width="6"/><path d="M63 82h36v18H63z" fill="#e5faff"/><circle cx="81" cy="91" r="5" fill="#286782"/>'],
  eletrico: ["Componente elétrico", '<rect x="40" y="44" width="82" height="67" rx="6" fill="#48a691"/><path d="M51 55h21v12h36M54 96h22V84h31" stroke="#c6f4b5" stroke-width="4"/><rect x="68" y="66" width="28" height="22" rx="3" fill="#233d51"/><circle cx="51" cy="55" r="4" fill="#fff"/><circle cx="106" cy="94" r="4" fill="#fff"/><circle cx="110" cy="56" r="5" fill="#f7cf82"/>'],
  dreno: ["Mangueira de dreno", '<path d="M27 86q7-36 40-36h20a20 20 0 1 1 0 40h-8q-16 0-20 18" stroke="#dae8f1" stroke-width="13"/><path d="M58 104v8M77 49v9M99 48l-5 8M105 83l7 4" stroke="#6d93a8" stroke-width="4"/><path d="M116 103q-11 13-11 17a11 11 0 0 0 22 0q0-4-11-17" fill="#76dbff"/>'],
  suporte: ["Suporte ou acabamento", '<path d="M47 34v78h70v-15H63V34z" fill="#e3edf6"/><path d="M60 102l46-38 9 12-46 38" fill="#95b8cc"/><path d="M51 45h8m-8 12h8m41 47h8" stroke="#3498ba" stroke-width="3"/>'],
  filtro: ["Filtro de ar", '<rect x="36" y="36" width="87" height="79" rx="8" fill="#a3c6da"/><path d="M45 46h68v60H45z" fill="#e8f6ff"/><path d="M54 47v57m11-57v57m10-57v57m11-57v57m11-57v57m10-57v57" stroke="#668fa8" stroke-width="4"/>'],
  generico: ["Produto", '<path d="M38 58l42-22 42 22v44l-42 23-42-23z" fill="#8fbad2"/><path d="M38 58l42 22 42-22-42-22z" fill="#d6edf8"/><path d="M80 80v45m-20-78l42 22v24" stroke="#426e89" stroke-width="4"/>'],
} as const;
export type ProductIllustrationKey = keyof typeof images;
const normalize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[-–_]/g," ");
function classify(text: string): ProductIllustrationKey | undefined {
  if (/\b(dreno|drenagem|mangueira)\b/.test(text)) return "dreno";
  if (/\b(isolamento|isolante|elastomeric\w*|espaguete)\b/.test(text)) return "isolamento";
  if (/\b(filtro|filtros)\b/.test(text)) return "filtro";
  if (/\b(suporte|canaleta|acabamento|defletor|base antivibracao)\b/.test(text)) return "suporte";
  if (/\b(placa|capacitor|contator|cabo|sensor|disjuntor|fusivel|chicote|rele|motor|controle remoto)\b/.test(text)) return "eletrico";
  if (/\b(cobre|conexao frigorigen\w*|tubulacao frigorigen\w*)\b/.test(text)) return "tubulacao";
  if (/^(gas|fluido|refrigerante)\b|\bfluido refrigerante\b/.test(text)) return "fluido";
  if (/\b(split|cassete|piso teto|vrf|vrv|chiller|fan coil|ar condicionado|evaporadora|condensadora|equipamentos?)\b/.test(text)) return "equipamento";
  if (/\b(fluido|refrigerante|r\s?(?:22|32|134a|410a|407c))\b/.test(text)) return "fluido";
}
export function inferProductIllustration(record: ProductImageDetails): ProductIllustrationKey {
  return classify(normalize(record.name||"")) ?? classify(normalize(record.description||"")) ?? classify(normalize(record.category||"")) ?? "generico";
}
const urls = Object.fromEntries(Object.entries(images).map(([key,[,drawing]])=>[key,"data:image/svg+xml;charset=utf-8,"+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 150"><defs><linearGradient id="p" x2="1" y2="1"><stop stop-color="#183954"/><stop offset="1" stop-color="#0c2538"/></linearGradient></defs><rect width="160" height="150" rx="12" fill="url(#p)"/><circle cx="80" cy="75" r="57" fill="#24445a"/><g stroke-linecap="round" stroke-linejoin="round" fill="none">${drawing}</g></svg>`)])) as Record<ProductIllustrationKey,string>;
export function productIllustration(record: ProductImageDetails) {
  const key=inferProductIllustration(record);
  return {key,label:images[key][0],url:urls[key]};
}
