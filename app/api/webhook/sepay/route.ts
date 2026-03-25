import { supabase } from "@/lib/supabase";
import { getBookingHostBankAccount } from "@/src/service/getBookingHostBankAccount";
import { extractBookingId } from "@/src/utils/extractBookingId";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const { transferAmount, content, accountNumber } = body;

    console.log("Webhook:", body);
    const bookingId = extractBookingId(content);
    
      console.log("bookingId", bookingId);

    if (!bookingId) {
      return NextResponse.json({ error: "Invalid contentasdasd" }, { status: 400 });
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

    // ❗ validate bank account
    const hostAccount = await getBookingHostBankAccount(bookingId);

    if (hostAccount?.account_number !== accountNumber) {
      return NextResponse.json(
        { error: "Wrong account: This bank account does not belong to the host" },
        { status: 400 },
      );
    }

    if (Number(transferAmount) !== booking.total_price) {
      return NextResponse.json({ error: "Wrong amount" }, { status: 400 });
    }

    if (booking.payment_status === "PAID") {
      return NextResponse.json({ message: "Already paid" });
    }

    // ✅ update
    await supabase
      .from("bookings")
      .update({ payment_status: "PAID" })
      .eq("id", bookingId);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
