import nodemailer from "nodemailer";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const CONTACT_EMAIL = "dragan.papic.czv@gmail.com";

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const name = normalizeText(body?.name);
  const email = normalizeText(body?.email);
  const subject = normalizeText(body?.subject);
  const message = normalizeText(body?.message);

  if (!name || !email || !subject || !message) {
    return NextResponse.json(
      { error: "Sva polja su obavezna." },
      { status: 400 },
    );
  }

  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return NextResponse.json(
      { error: "Email adresa nije ispravna." },
      { status: 400 },
    );
  }

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? "587");
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const isDev = process.env.NODE_ENV !== "production";

  const mailPayload = {
    from: process.env.CONTACT_FROM_EMAIL ?? user ?? "contact@localhost",
    to: process.env.CONTACT_TO_EMAIL ?? CONTACT_EMAIL,
    replyTo: email,
    subject: `[Kontakt forma] ${subject}`,
    text: [
      `Ime: ${name}`,
      `Email: ${email}`,
      "",
      "Poruka:",
      message,
    ].join("\n"),
    html: `
      <h2>Nova poruka sa kontakt forme</h2>
      <p><strong>Ime:</strong> ${name}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Naslov:</strong> ${subject}</p>
      <p><strong>Poruka:</strong></p>
      <p>${message.replace(/\n/g, "<br />")}</p>
    `,
  };

  if (!host || !user || !pass || !Number.isFinite(port)) {
    if (isDev) {
      // Development fallback: log to console instead of sending
      console.log("\n📬 [Contact form - DEV MODE - email NOT sent]");
      console.log("  To:     ", mailPayload.to);
      console.log("  From:   ", name, `<${email}>`);
      console.log("  Subject:", subject);
      console.log("  Message:", message);
      console.log(
        "\n  👉 Configure SMTP in .env.local to send real emails.\n",
      );
      return NextResponse.json({ success: true, devMode: true });
    }

    return NextResponse.json(
      {
        error:
          "SMTP nije konfigurisan. Podesite SMTP_HOST, SMTP_PORT, SMTP_USER i SMTP_PASS.",
      },
      { status: 500 },
    );
  }

  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: process.env.SMTP_SECURE === "true" || port === 465,
      auth: { user, pass },
    });

    await transporter.sendMail(mailPayload);
  } catch (err) {
    console.error("[Contact] SMTP error:", err);
    return NextResponse.json(
      { error: "Slanje poruke nije uspelo. Proverite SMTP podešavanja." },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}

