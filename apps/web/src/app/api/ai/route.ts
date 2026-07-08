import { NextRequest, NextResponse } from "next/server";

const SYSTEM_PROMPT = `Ti si kuvar-asistent na srpskom receptarskom portalu "Moja Kuhinja".
Pomazi korisnicima da pronadju recepte, predlozes jela na osnovu dostupnih namirnica i odgovaras na pitanja o kuvanju.
Uvek odgovaraj na srpskom jeziku. Budi koncizan, koristan i prijatan.`;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);

  if (!body?.prompt || !body?.provider) {
    return NextResponse.json(
      { error: "Prompt i provider su obavezni." },
      { status: 400 },
    );
  }

  const { provider, prompt, apiKey: bodyApiKey } = body as {
    provider: string;
    prompt: string;
    apiKey?: string;
  };

  try {
    if (provider === "openai") {
      const apiKey = process.env.OPENAI_API_KEY ?? bodyApiKey?.trim();
      if (!apiKey) {
        return NextResponse.json(
          {
            error:
              "OpenAI API kljuc nije konfigurisan na serveru i nije prosledjen kroz zahtev.",
          },
          { status: 500 },
        );
      }

      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: prompt },
          ],
          max_tokens: 1024,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message ?? "OpenAI greska");
      return NextResponse.json({
        response: data.choices?.[0]?.message?.content ?? "",
      });
    }

    if (provider === "gemini") {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return NextResponse.json(
          { error: "Gemini API kljuc nije konfigurisan na serveru." },
          { status: 500 },
        );
      }

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
            contents: [{ parts: [{ text: prompt }] }],
          }),
        },
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message ?? "Gemini greska");
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      return NextResponse.json({ response: text });
    }

    if (provider === "claude") {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        return NextResponse.json(
          { error: "Anthropic API kljuc nije konfigurisan na serveru." },
          { status: 500 },
        );
      }

      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-3-5-haiku-20241022",
          max_tokens: 1024,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message ?? "Claude greska");
      const text = data.content?.[0]?.text ?? "";
      return NextResponse.json({ response: text });
    }

    return NextResponse.json({ error: "Nepoznat AI provajder." }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Greska pri pozivu AI." },
      { status: 500 },
    );
  }
}

