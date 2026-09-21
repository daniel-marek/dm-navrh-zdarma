import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";

// Volá ho Vercel Cron (vercel.json), aby se free Supabase projekt nepozastavil pro neaktivitu.
export const GET: APIRoute = async ({ request }) => {
  const secret = import.meta.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createClient(
    import.meta.env.SUPABASE_URL,
    import.meta.env.SUPABASE_SERVICE_ROLE_KEY
  );
  const { error } = await supabase.from("form_logs").select("id", { head: true, count: "exact" });

  if (error) {
    console.error("Supabase keep-alive failed:", error.message);
    return new Response("Supabase error", { status: 502 });
  }
  return new Response("ok");
};
