import {NextRequest,NextResponse} from "next/server";
import {searchAutomaticTenders} from "@/app/api/licitacoes/route";
import {listPersistedOpportunities,persistRadar,scoreOpportunity} from "@/lib/procurement";
import {readSession} from "@/lib/proar-auth";
export async function GET(request:NextRequest){
  const session=readSession(request.cookies.get("proar_session")?.value);if(!session)return NextResponse.json({error:"Sessão inválida."},{status:401});
  const radius=Math.min(300,Math.max(1,Number(request.nextUrl.searchParams.get("radius")??300))),q=request.nextUrl.searchParams.get("q")?.trim();
  const result=await searchAutomaticTenders({radius,term:q,all:!q});
  const opportunities=result.data.map(item=>({canonicalId:item.numeroControlePNCP??`${item.orgaoEntidade?.cnpj}-${item.anoCompra}-${item.sequencialCompra}`,pncpId:item.numeroControlePNCP,source:item.sourcePortal??"PNCP",sourceUrl:item.linkSistemaOrigem,buyerName:item.orgaoEntidade?.razaoSocial,buyerCnpj:item.orgaoEntidade?.cnpj,city:item.unidadeOrgao?.municipioNome,state:item.unidadeOrgao?.ufSigla,modality:item.modalidadeNome,processNumber:item.sequencialCompra?`${item.anoCompra??""}/${item.sequencialCompra}`:undefined,object:item.objetoCompra??"Objeto não informado",estimatedValue:item.valorTotalEstimado,proposalEndAt:item.dataEncerramentoProposta,publishedAt:item.dataPublicacaoPncp,distanceKm:item.distanciaMirassol,score:scoreOpportunity({object:item.objetoCompra,estimatedValue:item.valorTotalEstimado,distanceKm:item.distanciaMirassol,proposalEnd:item.dataEncerramentoProposta})})).sort((a,b)=>b.score-a.score);
  try{await persistRadar(session,opportunities,result.failedSources);return NextResponse.json({success:true,data:await listPersistedOpportunities(session),warning:result.failedSources.length?`Consulta parcial: ${result.failedSources.join(", ")}.`:"",source:"Dados oficiais normalizados e persistidos"});}catch{return NextResponse.json({error:"O Radar não foi persistido. A migration permanece pendente."},{status:503});}
}
