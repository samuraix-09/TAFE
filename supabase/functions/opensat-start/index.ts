import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import { normalizeBank } from "./normalize.mjs";

const form = "fe816150-8c12-4b3a-b04a-000000000031";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: cors });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return reply({error:"Method not allowed"},405);
  const auth = req.headers.get("Authorization");
  if (!auth) return reply({error:"Sign in required"},401);
  const url = Deno.env.get("SUPABASE_URL")!;
  const student = createClient(url,Deno.env.get("SUPABASE_ANON_KEY")!,{global:{headers:{Authorization:auth}}});
  const {data: {user}} = await student.auth.getUser();
  if (!user) return reply({error:"Sign in required"},401);
  const existing = await student.rpc("start_exam_session",{t:form});
  if (!existing.error) return reply(existing.data);
  if (existing.error.message !== "OPENSAT_BANK_REQUIRED") return reply({error:existing.error.message});
  try {
    const bank = await Promise.all(["english","math"].map(async section => {
      const response = await fetch("https://pinesat.duckdns.org/api/questions?section="+section.toUpperCase(),{signal:AbortSignal.timeout(10000)});
      if (!response.ok) throw Error("Upstream HTTP failure");
      const raw = await response.text();
      if (raw.length > 16000000) throw Error("Upstream payload limit");
      const questions = normalizeBank(JSON.parse(raw),section);
      const count = section === "english" ? 27 : 22;
      // Sample each disjoint difficulty pool before sending it to PostgreSQL.
      return ["Medium","Easy","Hard"].flatMap((difficulty) => {
        const items = questions.filter(q=>q.difficulty===difficulty);
        for (let i=items.length-1;i>0;i--) {
          const j=Math.floor(Math.random()*(i+1));
          [items[i],items[j]]=[items[j],items[i]];
        }
        if (items.length<count) throw Error("Insufficient valid OpenSAT questions");
        return items.slice(0,count).map(q=>({...q,id:crypto.randomUUID(),sat_section:section==="english"?"reading_writing":"math"}));
      });
    }));
    const server = createClient(url,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const result = await server.rpc("start_opensat_with_bank",{learner:user.id,bank:bank.flat()});
    return result.error ? reply({error:result.error.message}) : reply(result.data);
  } catch {
    return reply({error:"OpenSAT savollarini yuklab bo‘lmadi. Qayta urinib ko‘ring."});
  }
});
