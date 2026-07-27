"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { forgotPassword } from "../../lib/api";
import { useTranslation } from "../../lib/useTranslation";
import styles from "../page.module.scss";

export default function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [devResetLink, setDevResetLink] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setDevResetLink("");
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);

    try {
      const response = await forgotPassword(String(formData.get("email") ?? ""));
      setSuccess(t("forgotPasswordSuccess"));
      if (response.devResetLink) {
        setDevResetLink(response.devResetLink);
      }
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : t("forgotPasswordRequestFailed"),
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <h1>{t("forgotPasswordTitle")}</h1>
          <p>{t("forgotPasswordDescription")}</p>
        </div>
      </header>

      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.field}>
          <label htmlFor="email">{t("email")}</label>
          <input id="email" name="email" required type="email" />
        </div>

        {error ? <p className={styles.error}>{error}</p> : null}
        {success ? <p className={styles.success}>{success}</p> : null}
        {devResetLink ? (
          <p className={styles.muted}>
            {t("devResetLinkLabel")} <a href={devResetLink}>{t("openResetLink")}</a>
          </p>
        ) : null}

        <button className={styles.button} disabled={isSubmitting}>
          {isSubmitting ? t("sending") : t("sendResetLink")}
        </button>
      </form>

      <p className={styles.muted}>
        <Link href="/login">{t("backToLogin")}</Link>
      </p>
    </main>
  );
}

