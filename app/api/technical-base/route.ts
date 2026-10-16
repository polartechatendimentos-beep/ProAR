import {NextRequest,NextResponse} from 'next/server';
import {technicalBaseAccess} from '@/lib/technical-base-access';
import {routeContext} from '@/lib/work-route-store';
import {normalizeDiagnosticManual} from '@/lib/diagnostic-manual-library';
export const runtime='nodejs';
const reply=(value:unknown,status=200)=>NextResponse.json(value,{status,headers:{'Cache-Control':'private, no-store'}});
export async function GET(request:NextRequest){
 const access=technicalBaseAccess(request);if(!access.ok)return reply({success:false,error:access.error},access.status);
 try{
  const context=await routeContext(access.session);
  const modules=context.state.moduleRecords||{};
  const records=['Manuais técnicos','Biblioteca técnica','Base Técnica'].flatMap(name=>Array.isArray(modules[name])?modules[name]:[]) as Record<string,unknown>[];
  const unique=[...new Map(records.map(record=>[String(record.id),record])).values()];
  const manuals=unique.filter(r=>!['Inativo','Cancelado'].includes(String(r.status||''))).map(normalizeDiagnosticManual).filter(r=>r?.verified&&r.url.startsWith('https://'));
  const data=manuals.map(r=>({id:r!.id,category:'manual',title:r!.title,brand:r!.brand,model:r!.models?.join(', '),url:r!.url,notes:[r!.notes,`Fonte: ${r!.source} • Documento revisado no cadastro da empresa; confirmar aplicabilidade ao modelo.`].filter(Boolean).join(' ')}));
  return reply({success:true,data,status:data.length?'configured':'catalog_not_configured',message:data.length?'Biblioteca da empresa autenticada.':'Nenhum manual homologado cadastrado nesta base.'});
 }catch{return reply({success:false,error:'Não foi possível consultar a biblioteca da empresa.'},503);}
}
