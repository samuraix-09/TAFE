import { createClient } from "@supabase/supabase-js";
export const supabaseUrl = "https://ydfmjhosuqabtgbksrsg.supabase.co";
export const supabasePublicKey =
  "sb_publishable_vuuHoCl8cp2VERayTnI5lA_rcXq-lpH";
export const db = createClient(supabaseUrl, supabasePublicKey);
const isVercelTafe = [
  "https://tafe-rust.vercel.app",
  "https://tafe-gaybullayevs176-4072.vercel.app",
].includes(location.origin);
export const tafeAuthFunction = isVercelTafe
  ? "emailjs-registration-vercel"
  : "emailjs-registration";
export const tafeAiFunction = isVercelTafe ? "tafe-ai-vercel" : "tafe-ai";

const authErrors: Record<string, string> = {
  invalid_credentials: "Email yoki parol noto‘g‘ri.",
  email_not_confirmed: "Email hali tasdiqlanmagan.",
  same_password: "Yangi parol joriy paroldan farq qilishi kerak.",
  weak_password: "Parol xavfsizlik talablariga mos kelmadi.",
  reauthentication_needed: "Parolni o‘zgartirish uchun qayta kiring.",
  session_not_found: "Sessiya tugagan. Qayta kiring.",
  over_request_rate_limit: "So‘rovlar juda ko‘p. Birozdan so‘ng qayta urining.",
};
export function authErrorMessage(error: unknown): string {
  if (error instanceof Error && "code" in error) {
    const code = typeof error.code === "string" ? error.code : "";
    return authErrors[code] || "So‘rov bajarilmadi. Qayta urinib ko‘ring.";
  }
  return error instanceof Error
    ? error.message
    : "So‘rov bajarilmadi. Internet ulanishini tekshiring.";
}
