export const municipalityDistances: Record<string, number> = {
  "Mirassol": 0,
  "Mirassolândia": 22,
  "São José do Rio Preto": 15,
  "Bady Bassitt": 18,
  "Bálsamo": 16,
  "Cedral": 32,
  "Guapiaçu": 35,
  "Ipiguá": 28,
  "Jaci": 14,
  "José Bonifácio": 42,
  "Mendonça": 48,
  "Monte Aprazível": 32,
  "Neves Paulista": 12,
  "Nipoã": 38,
  "Nova Aliança": 29,
  "Nova Granada": 45,
  "Poloni": 42,
  "Potirendaba": 40,
  "Tanabi": 36,
  "Uchôa": 48,
  "Olímpia": 65,
  "Barretos": 110,
  "Bebedouro": 105,
  "Catanduva": 75,
  "Votuporanga": 80,
  "Fernandópolis": 125,
  "Jales": 150,
  "Santa Fé do Sul": 195,
  "Monte Alto": 120,
  "Jaboticabal": 140,
  "Sertãozinho": 175,
  "Ribeirão Preto": 195,
  "Franca": 210,
  "Araraquara": 175,
  "São Carlos": 215,
  "Matão": 145,
  "Taquaritinga": 110,
  "Novo Horizonte": 85,
  "Lins": 115,
  "Penápolis": 105,
  "Birigui": 125,
  "Araçatuba": 140,
  "Andradina": 230,
  "Presidente Prudente": 260,
  "Marília": 170,
  "Assis": 240,
  "Bauru": 200,
  "Jaú": 235,
  "Botucatu": 290,
  "Piracicaba": 320,
  "Limeira": 330,
  "Rio Claro": 285,
  "Americana": 345,
  "Campinas": 370,
  "Jundiaí": 410,
  "Sorocaba": 430,
  "São José dos Campos": 530,
  "Santos": 520,
  "São Paulo (Capital)": 450,
  "Guarulhos": 460,
};

function normalizeCityName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[-_]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s*\(sp\)\s*/g, "")
    .trim();
}

export function getDistanceToMunicipality(destinationCity: string): number {
  if (!destinationCity) return 0;
  
  const normDest = normalizeCityName(destinationCity);

  for (const [city, dist] of Object.entries(municipalityDistances)) {
    if (normalizeCityName(city) === normDest) {
      return dist;
    }
  }

  for (const [city, dist] of Object.entries(municipalityDistances)) {
    const normCity = normalizeCityName(city);
    if (normDest.includes(normCity) || normCity.includes(normDest)) {
      return dist;
    }
  }

  return 45;
}

export function calculateDisplacementFee(destinationCity: string, costPerKm: number = 2.50): {
  distanciaKm: number;
  distanciaTotalKm: number;
  valorDeslocamento: number;
  valorFormatado: string;
} {
  const distanciaKm = getDistanceToMunicipality(destinationCity);
  const distanciaTotalKm = distanciaKm * 2;
  const valorDeslocamento = Math.round(distanciaTotalKm * costPerKm * 100) / 100;

  return {
    distanciaKm,
    distanciaTotalKm,
    valorDeslocamento,
    valorFormatado: `R$ ${valorDeslocamento.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
  };
}
