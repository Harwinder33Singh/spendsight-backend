// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const PLAID_CLIENT_ID = Deno.env.get("PLAID_CLIENT_ID")!
const PLAID_SECRET = Deno.env.get("PLAID_SECRET")!
const PLAID_ENV = Deno.env.get("PLAID_ENV") ?? "sandbox"
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

const plaidBaseUrl = `https://${PLAID_ENV}.plaid.com`

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
    const { user_id } = await req.json()

    if (!user_id) {
      return new Response(
        JSON.stringify({ error: "user_id is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      )
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    // Get all connected banks for this user
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

    // Sync each connected bank
    for (const item of items) {
      const { access_token, cursor, item_id, institution_name } = item

      let hasMore = true
      let nextCursor = cursor ?? ""
      let added: any[] = []

      // Paginate through all new transactions
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

      // Save updated cursor
      await supabase
        .from("plaid_items")
        .update({ cursor: nextCursor, updated_at: new Date().toISOString() })
        .eq("item_id", item_id)

      // Format transactions for the iOS app
      const formatted = added.map((t: any) => ({
        plaid_transaction_id: t.transaction_id,
        amount: t.amount,              // Plaid: positive = expense, negative = income
        date: t.date,
        merchant_name: t.merchant_name ?? t.name,
        plaid_category: t.personal_finance_category?.primary ?? t.category?.[0] ?? "Other",
        institution_name,
        item_id,
        account_id: t.account_id,
        pending: t.pending,
      }))

      allTransactions = allTransactions.concat(formatted)
    }

    return new Response(
      JSON.stringify({ transactions: allTransactions }),
      { headers: { "Content-Type": "application/json" } }
    )

  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
})
/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/plaid-sync-transactions' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/
