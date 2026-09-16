import {NextRequest,NextResponse} from "next/server";
import {auditBidSimulation,simulateBid} from "@/lib/procurement";
import {readSession} from "@/lib/proar-auth";
export async function POST(request:NextRequest){const session=readSession(request.cookies.get("proar_session")?.value);if(!session)return NextResponse.json({error:"Sessão inválida."},{status:401});const body=await request.json();try{const result=simulateBid(body??{});await auditBidSimulation(session,body??{},result);return NextResponse.json({success:true,data:result,externalAction:"copy_value_only"});}catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Não foi possível simular o lance."},{status:400});}}
