import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const PLAID_CLIENT_ID = Deno.env.get("PLAID_CLIENT_ID")!
const PLAID_SECRET    = Deno.env.get("PLAID_SECRET")!
const PLAID_ENV       = Deno.env.get("PLAID_ENV") ?? "sandbox"
const SUPABASE_URL    = Deno.env.get("SUPABASE_URL")!
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

const plaidBaseUrl = `https://${PLAID_ENV}.plaid.com`

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // ── Verify the caller is an authenticated Supabase user ──────────────────
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      )
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    )

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      )
    }

    const user_id = user.id  // verified — cannot be spoofed by the client

    // ── Create Plaid link token ───────────────────────────────────────────────
    const response = await fetch(`${plaidBaseUrl}/link/token/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: PLAID_CLIENT_ID,
        secret: PLAID_SECRET,
        client_name: "SpendSight",
        user: { client_user_id: user_id },
        products: ["transactions"],
        country_codes: ["US"],
        language: "en",
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: data.error_message ?? "Plaid error" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      )
    }

    return new Response(
      JSON.stringify({ link_token: data.link_token }),
      { headers: { "Content-Type": "application/json" } }
    )

  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
})
