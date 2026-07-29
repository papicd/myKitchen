"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { resetPassword } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { useTranslation } from "../../lib/useTranslation";
import styles from "../page.module.scss";

export default function ResetPasswordPage() {
  const { showApiError, showSuccess } = useAuth();
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const token = useMemo(() => searchParams.get("token")?.trim() ?? "", [searchParams]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!token) {
      setError(t("missingResetToken"));
      return;
    }

    const formData = new FormData(event.currentTarget);
    const newPassword = String(formData.get("newPassword") ?? "");
    const confirmPassword = String(formData.get("confirmPassword") ?? "");

    if (newPassword !== confirmPassword) {
      setError(t("passwordsDoNotMatch"));
      return;
    }

    setIsSubmitting(true);

    try {
      await resetPassword(token, newPassword);
      showSuccess(t("resetPasswordSuccess"));
      (event.currentTarget as HTMLFormElement).reset();
    } catch (submitError) {
      showApiError(submitError, t("resetPasswordRequestFailed"));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <h1>{t("resetPasswordTitle")}</h1>
          <p>{t("resetPasswordDescription")}</p>
        </div>
      </header>

      {!token ? <p className={styles.error}>{t("missingResetToken")}</p> : null}

      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.field}>
          <label htmlFor="newPassword">{t("newPassword")}</label>
          <input id="newPassword" name="newPassword" required type="password" />
        </div>

        <div className={styles.field}>
          <label htmlFor="confirmPassword">{t("confirmPassword")}</label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            required
            type="password"
          />
        </div>

        {error ? <p className={styles.error}>{error}</p> : null}

        <button className={styles.button} disabled={isSubmitting || !token}>
          {isSubmitting ? t("saving") : t("resetPasswordButton")}
        </button>
      </form>

      <p className={styles.muted}>
        <Link href="/login">{t("backToLogin")}</Link>
      </p>
    </main>
  );
}

