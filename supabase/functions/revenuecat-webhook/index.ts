import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const SUPABASE_URL         = Deno.env.get("SUPABASE_URL")!
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
const REVENUECAT_WEBHOOK_SECRET = Deno.env.get("REVENUECAT_WEBHOOK_SECRET")!

// RevenueCat event types that affect subscription status
const ACTIVE_EVENTS = new Set([
  "INITIAL_PURCHASE",
  "RENEWAL",
  "PRODUCT_CHANGE",
  "REACTIVATION",
  "UNCANCELLATION",
])

const EXPIRED_EVENTS = new Set([
  "EXPIRATION",
  "CANCELLATION",
  "BILLING_ISSUE",
])

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, content-type",
      },
    })
  }

  try {
    // ── Verify the request is genuinely from RevenueCat ──────────────────────
    const authHeader = req.headers.get("Authorization")
    if (!authHeader || authHeader !== `Bearer ${REVENUECAT_WEBHOOK_SECRET}`) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
    }

    const payload = await req.json()
    const event = payload.event

    if (!event) {
      return new Response(JSON.stringify({ error: "Invalid payload" }), { status: 400 })
    }

    const {
      type,
      app_user_id,           // this is the Supabase user UUID we set as the RevenueCat user ID
      expiration_at_ms,
      product_id,
    } = event

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    let subscription_tier   = "free"
    let subscription_status = "active"
    let subscription_expires_at: string | null = null

    if (ACTIVE_EVENTS.has(type)) {
      subscription_tier   = "pro"
      subscription_status = "active"
      subscription_expires_at = expiration_at_ms
        ? new Date(expiration_at_ms).toISOString()
        : null
    } else if (EXPIRED_EVENTS.has(type)) {
      subscription_tier   = "free"
      subscription_status = type === "EXPIRATION" ? "expired" : "cancelled"
      subscription_expires_at = expiration_at_ms
        ? new Date(expiration_at_ms).toISOString()
        : null
    } else {
      // Unhandled event type — acknowledge without updating
      return new Response(JSON.stringify({ received: true }), { status: 200 })
    }

    const { error } = await supabase
      .from("profiles")
      .update({
        subscription_tier,
        subscription_status,
        subscription_expires_at,
        updated_at: new Date().toISOString(),
      })
      .eq("id", app_user_id)

    if (error) {
      console.error("Failed to update profile:", error.message)
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      )
    }

    console.log(`[RC Webhook] ${type} → user ${app_user_id} → tier: ${subscription_tier}`)

    return new Response(
      JSON.stringify({ received: true }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    )

  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
})
