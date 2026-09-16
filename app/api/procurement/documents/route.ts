import {NextRequest,NextResponse} from "next/server";
import {listDocuments} from "@/lib/procurement";
import {readSession} from "@/lib/proar-auth";
export async function GET(request:NextRequest){const session=readSession(request.cookies.get("proar_session")?.value);if(!session)return NextResponse.json({error:"Sessão inválida."},{status:401});const canonicalId=String(request.nextUrl.searchParams.get("canonicalId")||"").trim();if(!canonicalId)return NextResponse.json({error:"Oportunidade não informada."},{status:400});try{return NextResponse.json({success:true,data:await listDocuments(session,canonicalId)});}catch{return NextResponse.json({error:"Documentos indisponíveis."},{status:503});}}
