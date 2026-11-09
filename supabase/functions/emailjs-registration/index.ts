import { createClient } from "npm:@supabase/supabase-js@2";
const allowedOrigins = new Set(
  (
    Deno.env.get("TAFE_ALLOWED_ORIGINS") ||
    "https://tafe-excellence.gaybullayevs1726615.chatgpt.site"
  )
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
);
const responseHeaders = {
  Vary: "Origin",
  "Cache-Control": "no-store",
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};
async function hash(value: string) {
  return [
    ...new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
    ),
  ]
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}
Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const headers = new Headers(responseHeaders);
  const reply = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers });
  if (origin && !allowedOrigins.has(origin))
    return reply(403, { error: "Noto‘g‘ri so‘rov." });
  if (origin) headers.set("Access-Control-Allow-Origin", origin);
  if (req.method === "OPTIONS") return new Response(null, { headers });
  if (req.method !== "POST") return reply(405, { error: "POST required" });
  try {
    const raw = await req.text();
    if (raw.length > 5000) return reply(413, { error: "So‘rov juda uzun." });
    let b;
    try {
      b = JSON.parse(raw);
    } catch {
      return reply(400, { error: "Noto‘g‘ri so‘rov." });
    }
    if (!b || typeof b !== "object" || Array.isArray(b))
      return reply(400, { error: "Noto‘g‘ri so‘rov." });
    const email =
      typeof b.email === "string" ? b.email.trim().toLowerCase() : "";
    if (email.length > 254 || !/^\S+@[^\s@]+\.[^\s@]+$/.test(email))
      return reply(400, { error: "Email manzil noto‘g‘ri." });
    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const options = {
      auth: { persistSession: false, autoRefreshToken: false },
    };
    const db = createClient(url, serviceKey, options);
    if (b.action === "send") {
      if (b.flow !== "signup" && b.flow !== "recovery")
        return reply(400, { error: "Noto‘g‘ri so‘rov." });
      const flow = b.flow;
      if (
        flow === "signup" &&
        (typeof b.name !== "string" || !b.name.trim() || b.name.length > 120)
      )
        return reply(400, { error: "Ism va parolni qayta tekshiring." });
      const id = crypto.randomUUID();
      const codeHash = "pending";
      const ipHash = await hash(
        (req.headers.get("x-forwarded-for")?.split(",")[0] || "unknown") +
          ":tafe-registration",
      );
      const quota = await db.rpc("reserve_registration", {
        request_id: id,
        target_email: email,
        hashed_code: codeHash,
        hashed_ip: ipHash,
      });
      if (quota.error) throw quota.error;
      if (!quota.data)
        return reply(429, {
          error:
            "Bir daqiqa kuting. Bir email uchun soatiga 5 ta kod yuborish mumkin.",
        });
      const existing = await db.rpc("registration_account", {
        target_email: email,
      });
      if (existing.error) throw existing.error;
      const account = existing.data?.[0];
      if (flow === "signup" && account?.confirmed)
        return reply(409, {
          error: "Bu email ro‘yxatdan o‘tgan. Parolingiz bilan kiring.",
        });
      if (flow === "recovery" && !account?.confirmed) {
        // A decoy challenge has no delivered code, so consumption always fails.
        const decoy = await db
          .from("registration_codes")
          .update({ flow })
          .eq("id", id);
        if (decoy.error) throw decoy.error;
        return reply(200, { requestId: id, expiresIn: 900, codeLength: 8 });
      }
      const generated =
        flow === "signup"
          ? await db.auth.admin.generateLink({
              type: "signup",
              email,
              // The chosen password is accepted only with proof of email ownership.
              password: crypto.randomUUID() + "Aa1!",
              options: { data: { display_name: b.name.trim() } },
            })
          : await db.auth.admin.generateLink({ type: "recovery", email });
      if (generated.error)
        return reply(400, {
          error: "Tasdiqlash kodi yaratilmadi. Yangi kod so‘rang.",
        });
      const passcode = generated.data.properties.email_otp;
      const saved = await db
        .from("registration_codes")
        .update({ flow, code_hash: await hash(id + ":" + passcode) })
        .eq("id", id);
      if (saved.error) throw saved.error;
      const privateKey = Deno.env.get("EMAILJS_PRIVATE_KEY");
      const sent = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(20000),
        body: JSON.stringify({
          service_id: Deno.env.get("EMAILJS_SERVICE_ID") || "service_dnp9fqi",
          template_id:
            Deno.env.get("EMAILJS_TEMPLATE_ID") || "template_2iu0omz",
          user_id: Deno.env.get("EMAILJS_PUBLIC_KEY") || "VTaL7umW-iQ38RXLx",
          ...(privateKey ? { accessToken: privateKey } : {}),
          template_params: {
            to_email: email,
            passcode,
            time:
              new Date(Date.now() + 900000).toLocaleString("en-GB", {
                timeZone: "Asia/Tashkent",
              }) + " (UTC+5)",
          },
        }),
      });
      if (!sent.ok) {
        console.error("EmailJS provider rejected request", sent.status);
        return reply(502, {
          error:
            "EmailJS xabarni yubora olmadi. Server sozlamalarini tekshiring.",
        });
      }
      const update = await db
        .from("registration_codes")
        .update({ delivered: true })
        .eq("id", id);
      if (update.error) throw update.error;
      return reply(200, {
        requestId: id,
        expiresIn: 900,
        codeLength: flow === "recovery" ? 8 : passcode.length,
      });
    }
    if (b.action === "verify") {
      if (
        typeof b.requestId !== "string" ||
        !/^[0-9a-f-]{36}$/.test(b.requestId) ||
        typeof b.code !== "string" ||
        !/^(?:\d{6}|\d{8})$/.test(b.code)
      )
        return reply(400, {
          error: "Email orqali kelgan kodni to‘liq kiriting (6 yoki 8 raqam).",
        });
      const challenge = await db
        .from("registration_codes")
        .select("flow")
        .eq("id", b.requestId)
        .eq("email", email)
        .maybeSingle();
      if (challenge.error) throw challenge.error;
      if (
        !challenge.data ||
        !["signup", "recovery"].includes(challenge.data.flow)
      )
        return reply(400, { error: "Yangi kod so‘rang." });
      if (
        challenge.data.flow === "signup" &&
        (typeof b.password !== "string" ||
          b.password.length < 8 ||
          b.password.length > 128 ||
          typeof b.name !== "string" ||
          !b.name.trim() ||
          b.name.length > 120)
      )
        return reply(400, { error: "Ism va parolni qayta tekshiring." });
      const result = await db.rpc("consume_registration", {
        request_id: b.requestId,
        target_email: email,
        hashed_code: await hash(b.requestId + ":" + b.code),
      });
      if (result.error) throw result.error;
      if (!result.data)
        return reply(400, {
          error:
            "Kod noto‘g‘ri, muddati tugagan yoki urinishlar soni oshgan. Yangi kod so‘rang.",
        });
      // verifyOtp changes the client's auth session. Keep that session separate
      // from the service client used for administrative writes.
      const verifier = createClient(url, anonKey, options);
      const verified = await verifier.auth.verifyOtp({
        email,
        token: b.code,
        type: challenge.data.flow as "signup" | "recovery",
      });
      if (verified.error || !verified.data.session || !verified.data.user)
        return reply(400, {
          error: "Kod Supabase tomonidan qabul qilinmadi. Yangi kod so‘rang.",
        });
      let session = verified.data.session;
      if (challenge.data.flow === "signup") {
        const secured = await db.auth.admin.updateUserById(
          verified.data.user.id,
          {
            password: b.password,
            user_metadata: { display_name: b.name.trim() },
          },
        );
        // An older pending signup may already use the requested password.
        if (secured.error && secured.error.code !== "same_password")
          return reply(400, {
            error:
              "Email tasdiqlandi, ammo parol saqlanmadi. Parolni tiklash orqali davom eting.",
          });
        const changed = await db
          .from("profiles")
          .update({ display_name: b.name.trim() })
          .eq("id", verified.data.user.id);
        if (changed.error) throw changed.error;
        // Return a session issued after the password change.
        const signedIn = await verifier.auth.signInWithPassword({
          email,
          password: b.password,
        });
        if (signedIn.error || !signedIn.data.session)
          return reply(400, {
            error: "Email tasdiqlandi. Hisobga qayta kiring.",
          });
        session = signedIn.data.session;
      }
      return reply(200, {
        session: {
          access_token: session.access_token,
          refresh_token: session.refresh_token,
        },
        flow: challenge.data.flow,
      });
    }
    return reply(400, { error: "Noto‘g‘ri amal." });
  } catch {
    return reply(500, { error: "So‘rov bajarilmadi. Qayta urinib ko‘ring." });
  }
});
