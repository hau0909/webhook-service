export function extractBookingId(content: string): string | null {
  if (!content) return null;

  // normalize (phòng trường hợp có dấu chấm, khoảng trắng, ký tự lạ)
  const text = content.toUpperCase();

  const match = text.match(/BK\s*(\d+)/);

  return match ? match[1] : null;
}

