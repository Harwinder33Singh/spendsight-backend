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

    // ── Load all connected banks for this user ───────────────────────────────
    const { data: items, error: fetchError } = await supabase
      .from("plaid_items")
      .select("*")
      .eq("user_id", user_id)

    if (fetchError || !items?.length) {
      return new Response(
        JSON.stringify({ transactions: [], message: "No connected banks" }),
        { headers: { "Content-Type": "application/json" } }
      )
    }

    let allTransactions: any[] = []

    // ── Sync each bank ───────────────────────────────────────────────────────
    for (const item of items) {
      const { access_token, cursor, item_id, institution_name } = item

      let hasMore = true
      let nextCursor = cursor ?? ""
      let added: any[] = []

      while (hasMore) {
        const syncResponse = await fetch(`${plaidBaseUrl}/transactions/sync`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            client_id: PLAID_CLIENT_ID,
            secret: PLAID_SECRET,
            access_token,
            cursor: nextCursor || undefined,
          }),
        })

        const syncData = await syncResponse.json()

        if (!syncResponse.ok) {
          console.error("Plaid sync error:", syncData.error_message)
          break
        }

        added = added.concat(syncData.added ?? [])
        hasMore = syncData.has_more
        nextCursor = syncData.next_cursor
      }

      // Save updated cursor (filter by both user_id and item_id for safety)
      await supabase
        .from("plaid_items")
        .update({ cursor: nextCursor, updated_at: new Date().toISOString() })
        .eq("item_id", item_id)
        .eq("user_id", user_id)

      if (added.length > 0) {
        const formatted = added.map((t: any) => ({
          user_id,
          plaid_transaction_id: t.transaction_id,
          amount: t.amount,
          date: t.date,
          merchant_name: t.merchant_name ?? t.name,
          plaid_category: t.personal_finance_category?.primary ?? t.category?.[0] ?? "Other",
          institution_name,
          item_id,
          account_id: t.account_id,
          pending: t.pending,
          updated_at: new Date().toISOString(),
        }))

        const { error: upsertError } = await supabase
          .from("transactions")
          .upsert(formatted, { onConflict: "plaid_transaction_id" })

        if (upsertError) {
          console.error("Failed to save transactions:", upsertError.message)
        }

        allTransactions = allTransactions.concat(formatted)
      }
    }

    // If no new transactions from Plaid, return what's already stored
    if (allTransactions.length === 0) {
      const { data: stored } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", user_id)
        .order("date", { ascending: false })

      allTransactions = stored ?? []
    }

    return new Response(
      JSON.stringify({ transactions: allTransactions, synced: allTransactions.length }),
      { headers: { "Content-Type": "application/json" } }
    )

  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
})
