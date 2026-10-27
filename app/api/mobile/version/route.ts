import {NextResponse} from "next/server";
import {MOBILE_RELEASE} from "../../../../lib/mobile-release";
export const dynamic="force-dynamic";
export function GET(){return NextResponse.json({version:MOBILE_RELEASE},{headers:{"Cache-Control":"no-store"}});}
