"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useAuth } from "../../lib/auth";
import sharedStyles from "../page.module.scss";
import styles from "./page.module.scss";

type Provider = "openai" | "gemini" | "claude";

const PROVIDERS: {
  id: Provider;
  name: string;
  model: string;
  badge: string;
}[] = [
  { id: "openai", name: "ChatGPT", model: "GPT-4o mini", badge: "OpenAI" },
  {
    id: "gemini",
    name: "Gemini",
    model: "Gemini 1.5 Flash",
    badge: "Google",
  },
  {
    id: "claude",
    name: "Claude",
    model: "Claude 3.5 Haiku",
    badge: "Anthropic",
  },
];

export default function FindAiPage() {
  const { isLoggedIn } = useAuth();
  const [provider, setProvider] = useState<Provider>("openai");
  const [response, setResponse] = useState("");
  const [usedProvider, setUsedProvider] = useState<Provider>("openai");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setResponse("");
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const prompt = String(formData.get("prompt"));

    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, prompt }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Greska pri pozivu AI");

      setUsedProvider(provider);
      setResponse(data.response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Greska pri pozivu AI");
    } finally {
      setLoading(false);
    }
  }

  if (!isLoggedIn) {
    return (
      <main className={sharedStyles.page}>
        <section className={sharedStyles.card}>
          <h1>AI asistent je dostupan nakon prijave</h1>
          <p className={sharedStyles.muted}>
            Prijavi se da koristis AI za predloge recepata i savete o kuvanju.
          </p>
          <div className={sharedStyles.actions}>
            <Link href="/login">Prijava</Link>
          </div>
        </section>
      </main>
    );
  }

  const activeProviderInfo = PROVIDERS.find((p) => p.id === provider)!;
  const usedProviderInfo = PROVIDERS.find((p) => p.id === usedProvider)!;

  return (
    <main className={sharedStyles.page}>
      <header className={sharedStyles.pageHeader}>
        <div>
          <h1>Pronadji sa AI</h1>
          <p>Pitaj AI asistenta za predlog recepta ili savet o kuvanju.</p>
        </div>
      </header>

      <p className={styles.hint}>
        Izaberi AI asistenta, unesi svoje pitanje ili nabroj namirnice koje imas
        i AI ce ti predloziti sta mozas da skuvas.
      </p>

      <div className={styles.providerTabs}>
        {PROVIDERS.map((p) => (
          <button
            key={p.id}
            type="button"
            className={`${styles.providerTab} ${provider === p.id ? styles.providerTabActive : ""}`}
            onClick={() => setProvider(p.id)}
            disabled={loading}
          >
            <span className={styles.providerName}>{p.name}</span>
            <span className={styles.providerModel}>{p.model}</span>
            <span className={styles.providerBadge}>{p.badge}</span>
          </button>
        ))}
      </div>

      <form className={sharedStyles.form} onSubmit={handleSubmit}>
        <div className={sharedStyles.field}>
          <label htmlFor="prompt">
            Pitanje za {activeProviderInfo.name}
          </label>
          <textarea
            id="prompt"
            name="prompt"
            placeholder={`Npr. "Imam piletinu, pirinac i papriku, sta mogu da skuvam?" ili "Predlozi mi brz rucak za 4 osobe."`}
            required
            disabled={loading}
          />
        </div>
        <button className={sharedStyles.button} disabled={loading}>
          {loading && <span className={styles.spinner} />}
          {loading ? "AI razmislja..." : `Pitaj ${activeProviderInfo.name}`}
        </button>
      </form>

      {error ? <p className={sharedStyles.error}>{error}</p> : null}

      {response ? (
        <div className={styles.responseBox}>
          <div className={styles.responseHeader}>
            <h2 className={styles.responseTitle}>Odgovor AI asistenta</h2>
            <span className={styles.responseProvider}>
              {usedProviderInfo.name}
            </span>
          </div>
          <div className={styles.responseBody}>{response}</div>
        </div>
      ) : null}
    </main>
  );
}

