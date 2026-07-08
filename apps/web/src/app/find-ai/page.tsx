"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useAuth } from "../../lib/auth";
import { useTranslation } from "../../lib/useTranslation";
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
  const { t } = useTranslation();
  const [provider, setProvider] = useState<Provider>("openai");
  const [openAiApiKey, setOpenAiApiKey] = useState("");
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
        body: JSON.stringify({
          provider,
          prompt,
          apiKey: provider === "openai" ? openAiApiKey.trim() || undefined : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t("aiError"));

      setUsedProvider(provider);
      setResponse(data.response);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("aiError"));
    } finally {
      setLoading(false);
    }
  }

  if (!isLoggedIn) {
    return (
      <main className={sharedStyles.page}>
        <section className={sharedStyles.card}>
          <h1>{t("aiNotAvailable")}</h1>
          <p className={sharedStyles.muted}>
            {t("loginAndUseAI")}
          </p>
          <div className={sharedStyles.actions}>
            <Link href="/login">{t("login")}</Link>
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
          <h1>{t("findWithAITitle")}</h1>
          <p>{t("findWithAIDescription")}</p>
        </div>
      </header>

      <p className={styles.hint}>
        {t("aiInstructions")}
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
            {t("askProvider", { provider: activeProviderInfo.name })}
          </label>
          <textarea
            id="prompt"
            name="prompt"
            placeholder={`${t("askAIPlaceholder1")} ${t("askAIPlaceholder2")}`}
            required
            disabled={loading}
          />
        </div>

        {provider === "openai" ? (
          <div className={sharedStyles.field}>
            <label htmlFor="openAiApiKey">{t("openAiApiKeyLabel")}</label>
            <input
              id="openAiApiKey"
              type="password"
              autoComplete="off"
              value={openAiApiKey}
              onChange={(e) => setOpenAiApiKey(e.target.value)}
              placeholder={t("openAiApiKeyPlaceholder")}
              disabled={loading}
            />
            <small className={sharedStyles.muted}>{t("openAiApiKeyHint")}</small>
          </div>
        ) : null}

        <button className={sharedStyles.button} disabled={loading}>
          {loading && <span className={styles.spinner} />}
          {loading ? t("aiThinking") : t("askProvider", { provider: activeProviderInfo.name })}
        </button>
      </form>

      {error ? <p className={sharedStyles.error}>{error}</p> : null}

      {response ? (
        <div className={styles.responseBox}>
          <div className={styles.responseHeader}>
            <h2 className={styles.responseTitle}>{t("aiResponse")}</h2>
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

