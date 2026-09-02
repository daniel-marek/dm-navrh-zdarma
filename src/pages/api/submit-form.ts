import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";

interface FormPayload {
  name: string;
  email: string;
  phone: string;
  note?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_CHARS_RE = /^[0-9+\-\s()]+$/;

function isValidPhone(phone: string): boolean {
  if (!PHONE_CHARS_RE.test(phone)) return false;
  const digitCount = phone.replace(/\D/g, "").length;
  return digitCount >= 9 && digitCount <= 15;
}

function validate(body: unknown): { valid: true; data: FormPayload } | { valid: false; error: string } {
  if (typeof body !== "object" || body === null) {
    return { valid: false, error: "Neplatná data formuláře." };
  }
  const { name, email, phone, note } = body as Record<string, unknown>;

  if (typeof name !== "string" || name.trim() === "") {
    return { valid: false, error: "Vyplňte prosím jméno." };
  }
  if (typeof email !== "string" || !EMAIL_RE.test(email.trim())) {
    return { valid: false, error: "Zadejte prosím platný email." };
  }
  if (typeof phone !== "string" || phone.trim() === "") {
    return { valid: false, error: "Vyplňte prosím telefon." };
  }
  if (!isValidPhone(phone.trim())) {
    return { valid: false, error: "Zadejte prosím platné telefonní číslo." };
  }

  return {
    valid: true,
    data: {
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      note: typeof note === "string" ? note.trim() : "",
    },
  };
}

// Merge tag vlastního pole "Poznámka" v Ecomailu (zobrazeno jako *|poznamka|* — API
// očekává klíč bez obálky *| |*).
const ECOMAIL_NOTE_FIELD = import.meta.env.ECOMAIL_NOTE_FIELD || "poznamka";

async function submitToEcomail(data: FormPayload): Promise<void> {
  const apiKey = import.meta.env.ECOMAIL_API_KEY;
  const listId = import.meta.env.ECOMAIL_LIST_ID;

  const subscriberData: Record<string, unknown> = {
    email: data.email,
    name: data.name,
    phone: data.phone,
  };
  if (data.note) {
    subscriberData.custom_fields = { [ECOMAIL_NOTE_FIELD]: data.note };
  }

  const res = await fetch(`https://api2.ecomailapp.cz/lists/${listId}/subscribe`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      key: apiKey,
    },
    body: JSON.stringify({
      subscriber_data: subscriberData,
      update_existing: true,
      resubscribe: true,
      skip_confirmation: true,
      trigger_autoresponders: false,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Ecomail error ${res.status}: ${text}`);
  }
}

async function sendNotificationEmail(data: FormPayload): Promise<void> {
  const apiKey = import.meta.env.RESEND_API_KEY;
  const from = import.meta.env.RESEND_FROM_EMAIL;
  const to = import.meta.env.NOTIFICATION_EMAIL;

  const lines = [
    `Jméno: ${data.name}`,
    `Email: ${data.email}`,
    `Telefon: ${data.phone}`,
    data.note ? `Poznámka: ${data.note}` : null,
  ].filter(Boolean);

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: `Nová poptávka z webu — ${data.name}`,
      text: lines.join("\n"),
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Resend error ${res.status}: ${text}`);
  }
}

async function logToSupabase(data: FormPayload): Promise<void> {
  const supabaseUrl = import.meta.env.SUPABASE_URL;
  const serviceRoleKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const { error } = await supabase.from("form_submissions").insert({
    name: data.name,
    email: data.email,
    phone: data.phone,
    note: data.note || null,
  });

  if (error) {
    throw new Error(`Supabase error: ${error.message}`);
  }
}

export const POST: APIRoute = async ({ request }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ success: false, error: "Neplatná data formuláře." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const validation = validate(body);
  if (!validation.valid) {
    return new Response(JSON.stringify({ success: false, error: validation.error }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const [ecomailResult, resendResult, supabaseResult] = await Promise.allSettled([
    submitToEcomail(validation.data),
    sendNotificationEmail(validation.data),
    logToSupabase(validation.data),
  ]);

  if (ecomailResult.status === "rejected") {
    console.error("Ecomail submission failed:", ecomailResult.reason);
  }
  if (resendResult.status === "rejected") {
    console.error("Resend notification failed:", resendResult.reason);
  }
  if (supabaseResult.status === "rejected") {
    console.error("Supabase log failed:", supabaseResult.reason);
  }

  if (ecomailResult.status === "fulfilled" || supabaseResult.status === "fulfilled") {
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(
    JSON.stringify({ success: false, error: "Odeslání se nezdařilo, zkuste to prosím znovu." }),
    { status: 502, headers: { "Content-Type": "application/json" } }
  );
};
