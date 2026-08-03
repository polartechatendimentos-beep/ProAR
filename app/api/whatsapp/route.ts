import { NextResponse } from "next/server";
import { sendWhatsAppNotification } from "@/lib/proar-whatsapp";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await sendWhatsAppNotification({
      to: body.to,
      message: body.message,
    });

    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
