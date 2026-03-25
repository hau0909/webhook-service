/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from "@/lib/supabase";
import { BankAccount } from "../types/bankAccount";

/**
 * Get the bank account of the host associated with a booking
 * Path: booking_id -> listing_id -> host_id -> bankaccount (profile_id)
 */
export const getBookingHostBankAccount = async (
  bookingId: string | number,
): Promise<BankAccount | null> => {
  // 1. Get host_id from booking -> listing
  const { data: bookingData, error: bookingError } = await supabase
    .from("bookings")
    .select(
      `
      listing:listings (
        host_id
      )
    `,
    )
    .eq("id", bookingId)
    .single();

  if (bookingError) {
    if (bookingError.code === "PGRST116") return null; // Booking not found
    console.error("Error fetching booking host info:", bookingError);
    throw new Error(
      `Failed to fetch booking host info: ${bookingError.message}`,
    );
  }

  const hostId = (bookingData as any)?.listing?.host_id;

  if (!hostId) {
    return null;
  }

  // 2. Get bank account for that host (profile_id)
  const { data: bankData, error: bankError } = await supabase
    .from("bank_accounts")
    .select("*")
    .eq("profile_id", hostId)
    .single();

  if (bankError) {
    if (bankError.code === "PGRST116") return null; // No bank account found
    console.error("Error fetching host bank account:", bankError);
    throw new Error(`Failed to fetch host bank account: ${bankError.message}`);
  }

  return bankData as BankAccount;
};
