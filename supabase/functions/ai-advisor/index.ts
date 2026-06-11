import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const SUPABASE_URL      = Deno.env.get("SUPABASE_URL")!
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // ── Auth ────────────────────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders })
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    )
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders })
    }

    // ── Body ─────────────────────────────────────────────────────────────────
    const { message, context } = await req.json()
    if (!message || typeof message !== "string") {
      return new Response(JSON.stringify({ error: "Missing message" }), { status: 400, headers: corsHeaders })
    }

    const today = new Date().toISOString().split("T")[0]

    const systemPrompt = `You are a personal financial advisor inside the SpendSight app. You have real access to this user's financial data. Give specific, actionable advice using their actual numbers.

USER FINANCIAL DATA (as of ${today}):
${JSON.stringify(context, null, 2)}

Rules:
- Always reference the user's real dollar amounts — never use placeholders like "$X"
- For trip/purchase planning: estimate realistic costs and compare to their savings capacity and budget remaining
- Flag over-budget categories proactively with the exact amounts
- Give 2-3 concrete action steps with specific dollar targets
- Keep response under 350 words
- Use **bold** for key numbers and bullet points for recommendations
- Be honest but encouraging — if something is out of reach, say so and offer an alternative timeline`

    // ── Call Anthropic (streaming) ───────────────────────────────────────────
    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 600,
        stream: true,
        system: systemPrompt,
        messages: [{ role: "user", content: message }],
      }),
    })

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text()
      return new Response(JSON.stringify({ error: errText }), { status: 500, headers: corsHeaders })
    }

    // ── Pipe Anthropic SSE → client SSE ─────────────────────────────────────
    const stream = new ReadableStream({
      async start(controller) {
        const enc = new TextEncoder()
        const reader = anthropicRes.body!.getReader()
        const dec = new TextDecoder()
        let buf = ""

        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            buf += dec.decode(value, { stream: true })
            const lines = buf.split("\n")
            buf = lines.pop() ?? ""

            for (const line of lines) {
              if (!line.startsWith("data: ")) continue
              const raw = line.slice(6).trim()
              if (raw === "[DONE]") {
                controller.enqueue(enc.encode("data: [DONE]\n\n"))
                controller.close()
                return
              }
              try {
                const ev = JSON.parse(raw)
                if (ev.type === "content_block_delta" && ev.delta?.type === "text_delta") {
                  controller.enqueue(enc.encode(`data: ${JSON.stringify({ text: ev.delta.text })}\n\n`))
                }
              } catch { /* skip malformed */ }
            }
          }
        } finally {
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    })

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders })
  }
})
