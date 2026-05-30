import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const PLAID_CLIENT_ID      = Deno.env.get("PLAID_CLIENT_ID")!
const PLAID_SECRET         = Deno.env.get("PLAID_SECRET")!
const PLAID_ENV            = Deno.env.get("PLAID_ENV") ?? "sandbox"
const SUPABASE_URL         = Deno.env.get("SUPABASE_URL")!
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
    // ── Verify caller ────────────────────────────────────────────────────────
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

    const user_id = user.id

    // ── Exchange public token ────────────────────────────────────────────────
    const { public_token } = await req.json()

    if (!public_token) {
      return new Response(
        JSON.stringify({ error: "public_token is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      )
    }

    const exchangeResponse = await fetch(`${plaidBaseUrl}/item/public_token/exchange`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: PLAID_CLIENT_ID,
        secret: PLAID_SECRET,
        public_token,
      }),
    })

    const exchangeData = await exchangeResponse.json()

    if (!exchangeResponse.ok) {
      return new Response(
        JSON.stringify({ error: exchangeData.error_message ?? "Exchange failed" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      )
    }

    const { access_token, item_id } = exchangeData

    // ── Fetch institution name ───────────────────────────────────────────────
    const itemResponse = await fetch(`${plaidBaseUrl}/item/get`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: PLAID_CLIENT_ID,
        secret: PLAID_SECRET,
        access_token,
      }),
    })

    const itemData = await itemResponse.json()
    const institution_id = itemData.item?.institution_id
    let institution_name = "Unknown Bank"

    if (institution_id) {
      const instResponse = await fetch(`${plaidBaseUrl}/institutions/get_by_id`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: PLAID_CLIENT_ID,
          secret: PLAID_SECRET,
          institution_id,
          country_codes: ["US"],
        }),
      })
      const instData = await instResponse.json()
      institution_name = instData.institution?.name ?? "Unknown Bank"
    }

    // ── Store access token in Supabase ───────────────────────────────────────
    const { error: dbError } = await supabase
      .from("plaid_items")
      .upsert({
        user_id,
        access_token,
        item_id,
        institution_name,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id, item_id" })

    if (dbError) {
      return new Response(
        JSON.stringify({ error: dbError.message }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      )
    }

    return new Response(
      JSON.stringify({ success: true, institution_name, item_id }),
      { headers: { "Content-Type": "application/json" } }
    )

  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
})
