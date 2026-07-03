import { supabase } from "@/lib/supabase";
import { getBookingHostBankAccount } from "@/src/service/getBookingHostBankAccount";
import { extractBookingId } from "@/src/utils/extractBookingId";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("Authorization");
    const expectedToken = process.env.SEPAY_WEBHOOK_TOKEN;
    if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { transferAmount, content, accountNumber } = body;
    console.log("Webhook received:", body);

    // 1. SaaS Plan Payment Logic (TXN-...)
    const txnMatch = content?.match(/TXN-\d+-\d+/);
    if (txnMatch) {
      const transactionCode = txnMatch[0];
      const { data: payment } = await supabase
        .from("payments")
        .select("*")
        .eq("transaction_code", transactionCode)
        .single();

      if (!payment) {
        return NextResponse.json({ success: true, message: "Payment not found" }, { status: 200 });
      }

      if (payment.payment_status === "pending" && transferAmount >= payment.amount) {
        // Mark payment as completed
        const paidAt = new Date().toISOString();
        await supabase
          .from("payments")
          .update({ payment_status: "completed", paid_at: paidAt })
          .eq("payment_id", payment.payment_id);

        // Get plan duration
        const { data: plan } = await supabase
          .from("plans")
          .select("duration_days")
          .eq("plan_id", payment.plan_id)
          .single();

        if (plan) {
          const startDate = new Date();
          const endDate = new Date();
          endDate.setDate(startDate.getDate() + plan.duration_days);

          // Deactivate old active subscriptions for the same company
          await supabase
            .from("subscriptions")
            .update({ status: "unactive" })
            .eq("company_id", payment.company_id)
            .eq("status", "active");

          // Activate new subscription
          await supabase
            .from("subscriptions")
            .update({ 
              status: "active", 
              start_date: startDate.toISOString().split("T")[0], 
              end_date: endDate.toISOString().split("T")[0],
              updated_at: paidAt
            })
            .eq("subscription_id", payment.subscription_id);
        }
        return NextResponse.json({ success: true, message: "SaaS Payment processed successfully" }, { status: 200 });
      }

      return NextResponse.json({ success: true, message: "SaaS Payment condition not met" }, { status: 200 });
    }

    // 2. Booking Payment Logic (BK...)
    const bookingId = extractBookingId(content);
    console.log("bookingId", bookingId);

    if (!bookingId) {
      return NextResponse.json(
        { error: "Invalid content" },
        { status: 400 },
      );
    }

    const { data: booking } = await supabase
      .from("bookings")
      .select("*")
      .eq("id", bookingId)
      .single();

    if (!booking) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const hostAccount = await getBookingHostBankAccount(bookingId);

    if (hostAccount?.account_number !== accountNumber) {
      return NextResponse.json(
        {
          error: "Wrong account: This bank account does not belong to the host",
        },
        { status: 400 },
      );
    }

    if (Number(transferAmount) !== booking.total_price * 25000) {
      return NextResponse.json({ error: "Wrong amount" }, { status: 400 });
    }

    if (booking.payment_status === "PAID") {
      return NextResponse.json({ message: "Already paid" });
    }

    const { error: updateError } = await supabase
      .from("bookings")
      .update({ payment_status: "PAID" })
      .eq("id", bookingId);

    if (updateError) {
      console.error("Supabase Update Error:", updateError);
      return NextResponse.json(
        { error: "Failed to update booking" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
