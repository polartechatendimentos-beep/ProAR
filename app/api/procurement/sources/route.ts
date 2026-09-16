import {NextRequest,NextResponse} from "next/server";
import {listProcurementSources} from "@/lib/procurement";
import {readSession} from "@/lib/proar-auth";
export async function GET(request:NextRequest){const session=readSession(request.cookies.get("proar_session")?.value);if(!session)return NextResponse.json({error:"Sessão inválida."},{status:401});try{return NextResponse.json({success:true,data:await listProcurementSources(session)});}catch{return NextResponse.json({error:"Catálogo de fontes indisponível. Confirme a migration de licitações."},{status:503});}}
