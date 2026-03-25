import { supabase } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const { amount, content, account_number } = body;

    console.log("Webhook:", body);

    const bookingId = content?.split("_")[1];

    if (!bookingId) {
      return NextResponse.json({ error: "Invalid content" }, { status: 400 });
    }

    // 🔥 lấy booking
    const { data: booking } = await supabase
      .from("bookings")
      .select("*")
      .eq("id", bookingId)
      .single();

    if (!booking) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // ❗ validate
    if (booking.bank_account !== account_number) {
      return NextResponse.json({ error: "Wrong account" }, { status: 400 });
    }

    if (Number(amount) !== booking.amount) {
      return NextResponse.json({ error: "Wrong amount" }, { status: 400 });
    }

    if (booking.status === "paid") {
      return NextResponse.json({ message: "Already paid" });
    }

    // ✅ update
    await supabase
      .from("bookings")
      .update({ payment_status: "paid" })
      .eq("id", bookingId);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
