import { NextResponse } from "next/server";
import { readSession } from "@/lib/proar-auth";
/** No fabricated manuals or error codes. Future records must be scoped to authenticated tenant. */
export async function GET(request: Request) {
  const session = await readSession(request);
  if (!session) return NextResponse.json({ success:false, error:"Não autorizado" }, {status:401});
  return NextResponse.json({ success:true, data:[], status:"catalog_not_configured", message:"Nenhum manual ou código técnico homologado cadastrado nesta versão." });
}
