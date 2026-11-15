import { NextRequest, NextResponse } from "next/server";
import { procurementAccess } from "../../../../lib/procurement/access";
import { municipalityNameDistances } from "../../../../lib/municipality-distances";

export const runtime = "nodejs";

export async function GET(request:NextRequest){
  const access=procurementAccess(request);
  if(!access.ok)return NextResponse.json({error:access.error},{status:access.status,headers:{"Cache-Control":"private, no-store"}});
  const radius=Number(request.nextUrl.searchParams.get("raio_km")||400);
  if(!Number.isFinite(radius)||radius<1||radius>1000)return NextResponse.json({error:"Informe um raio entre 1 e 1.000 km."},{status:400,headers:{"Cache-Control":"private, no-store"}});
  const cities=Object.entries(municipalityNameDistances)
    .map(([key,distance])=>{const [name,uf]=key.split("|");return{name,uf,distance};})
    .filter(city=>city.name&&/^[A-Z]{2}$/.test(city.uf)&&distanceWithinRadius(city.distance,radius))
    .sort((a,b)=>a.distance-b.distance||a.name.localeCompare(b.name,"pt-BR")||a.uf.localeCompare(b.uf));
  return NextResponse.json({origin:{city:"Mirassol",uf:"SP"},radiusKm:radius,total:cities.length,cities,coverageStates:["SP","MG","MS","PR","GO"],distanceType:"aproximada"}, {headers:{"Cache-Control":"private, max-age=300, stale-while-revalidate=600"}});
}
function distanceWithinRadius(distance:number,radius:number){return Number.isFinite(distance)&&distance<=radius;}
