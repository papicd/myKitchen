"use client";

import { FormEvent, useState } from "react";
import { useTranslation } from "@/lib/useTranslation";
import styles from "../page.module.scss";

export default function ContactPage() {
  const { t } = useTranslation();
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setSending(true);

    const form = event.currentTarget;
    const formData = new FormData(form);

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: String(formData.get("name") ?? ""),
          email: String(formData.get("email") ?? ""),
          subject: String(formData.get("subject") ?? ""),
          message: String(formData.get("message") ?? ""),
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setError(data?.error ?? t("contactSendError"));
        return;
      }

      form.reset();
      setSuccess(
        data?.devMode
          ? t("contactSendSuccessDev")
          : t("contactSendSuccess"),
      );
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : t("contactSendError"));
    } finally {
      setSending(false);
    }
  }

  return (
    <main className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <h1>{t("contactTitle")}</h1>
          <p>{t("contactDescription")}</p>
        </div>
      </header>

      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.field}>
          <label htmlFor="name">{t("contactName")}</label>
          <input id="name" name="name" required />
        </div>
        <div className={styles.field}>
          <label htmlFor="email">{t("contactEmail")}</label>
          <input id="email" name="email" type="email" required />
        </div>
        <div className={styles.field}>
          <label htmlFor="subject">{t("contactSubject")}</label>
          <input id="subject" name="subject" required />
        </div>
        <div className={styles.field}>
          <label htmlFor="message">{t("contactMessage")}</label>
          <textarea id="message" name="message" required rows={6} />
        </div>

        {error ? <p className={styles.error}>{error}</p> : null}
        {success ? <p className={styles.success}>{success}</p> : null}

        <button className={styles.button} type="submit" disabled={sending}>
          {sending ? t("sending") : t("sendMail")}
        </button>
      </form>
    </main>
  );
}

