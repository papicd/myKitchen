"use client";

import { FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { login } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { useTranslation } from "../../lib/useTranslation";
import styles from "../page.module.scss";

export default function LoginPage() {
  const router = useRouter();
  const { saveAuth, showApiError, showSuccess } = useAuth();
  const { t } = useTranslation();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);

    try {
      const auth = await login(
        String(formData.get("email")),
        String(formData.get("password")),
      );
      saveAuth(auth);
      showSuccess(t("signedIn"));
      router.push("/");
    } catch (loginError) {
      showApiError(loginError, t("loginFailed"));
    }
  }

  return (
    <main className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <h1>{t("loginTitle")}</h1>
          <p>{t("loginDescription")}</p>
        </div>
      </header>

      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.field}>
          <label htmlFor="email">{t("email")}</label>
          <input id="email" name="email" required type="email" />
        </div>
        <div className={styles.field}>
          <label htmlFor="password">{t("password")}</label>
          <input id="password" name="password" required type="password" />
        </div>
        <p className={styles.muted}>
          <Link href="/forgot-password">{t("forgotPasswordLink")}</Link>
        </p>
        <button className={styles.button}>{t("loginButton")}</button>
      </form>

      <p className={styles.muted}>
        {t("noAccount")} <Link href="/signup">{t("registerNow")}</Link>
      </p>
    </main>
  );
}
