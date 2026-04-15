// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
const PLAID_CLIENT_ID = Deno.env.get("PLAID_CLIENT_ID")!
const PLAID_SECRET = Deno.env.get("PLAID_SECRET")!
const PLAID_ENV = Deno.env.get("PLAID_ENV") ?? "sandbox"

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

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/plaid-create-link-token' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/
