import {parseOlimpiaDetail} from "../lib/procurement/olimpia-connector.ts";
import {pncpProposalQuery,tenderSearchMatches} from "../lib/procurement/search-relevance.ts";
let failed=false;
try{
 const url="https://www.olimpia.sp.gov.br/portal/editais/0/1/5114/";
 const response=await fetch(url,{signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw new Error("HTTP "+response.status);
 const item=parseOlimpiaDetail(await response.text(),url);
 if(!item)throw new Error("Formato do portal não reconhecido");
 console.log("OLIMPIA_LIVE="+JSON.stringify({number:item.numeroCompra,status:item.situacaoCompraNome,deadline:item.dataEncerramentoProposta,source:item.linkSistemaOrigem}));
}catch(error){failed=true;console.log("OLIMPIA_LIVE_UNAVAILABLE="+error.message);}
try{
 const end=new Date(Date.now()+366*86400000).toISOString().slice(0,10).replaceAll("-","");
 let found=null,count=0;
 for(let page=1;page<=5;page++){
  const query=pncpProposalQuery(end,"SP",6,page,"3549805");
  const response=await fetch("https://pncp.gov.br/api/consulta/v1/contratacoes/proposta?"+query,{signal:AbortSignal.timeout(12000)});
  if(response.status===204)break;if(!response.ok)throw new Error("HTTP "+response.status);
  const body=await response.json(),items=body.data||[];count+=items.length;
  found=items.find(item=>item.numeroControlePNCP==="46588950000180-1-000948/2026");
  if(found||page>=Number(body.totalPaginas)||items.length<50)break;
 }
 console.log("RIO_PRETO_LIVE="+JSON.stringify({received:count,exampleFound:!!found,...(found?{control:found.numeroControlePNCP,number:found.numeroCompra,deadline:found.dataEncerramentoProposta,relevant:tenderSearchMatches(found.objetoCompra,found.objetoCompra,"ar condicionado")}:{note:"Exemplo não retornado na janela atual; pode ter sido alterado/encerrado na origem."})}));
}catch(error){failed=true;console.log("PNCP_LIVE_UNAVAILABLE="+error.message);}
if(failed)process.exitCode=1;
