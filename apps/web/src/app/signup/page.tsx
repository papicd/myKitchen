"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { signup } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { useTranslation } from "../../lib/useTranslation";
import styles from "../page.module.scss";

export default function SignupPage() {
  const router = useRouter();
  const { saveAuth } = useAuth();
  const { t } = useTranslation();
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const formData = new FormData(event.currentTarget);

    try {
      const auth = await signup({
        firstName: String(formData.get("firstName")),
        lastName: String(formData.get("lastName")),
        username: String(formData.get("username")),
        email: String(formData.get("email")),
        password: String(formData.get("password")),
      });
      saveAuth(auth);
      router.push("/");
    } catch (signupError) {
      setError(
        signupError instanceof Error
          ? signupError.message
            : t("registrationFailed"),
      );
    }
  }

  return (
    <main className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <h1>{t("registerTitle")}</h1>
          <p>{t("registerDescription")}</p>
        </div>
      </header>

      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.field}>
          <label htmlFor="firstName">{t("firstName")}</label>
          <input id="firstName" name="firstName" required />
        </div>
        <div className={styles.field}>
          <label htmlFor="lastName">{t("lastName")}</label>
          <input id="lastName" name="lastName" required />
        </div>
        <div className={styles.field}>
          <label htmlFor="username">{t("username")}</label>
          <input id="username" name="username" required />
        </div>
        <div className={styles.field}>
          <label htmlFor="email">{t("email")}</label>
          <input id="email" name="email" required type="email" />
        </div>
        <div className={styles.field}>
          <label htmlFor="password">{t("password")}</label>
          <input id="password" name="password" required type="password" />
        </div>
        {error ? <p className={styles.error}>{error}</p> : null}
        <button className={styles.button}>{t("registerButton")}</button>
      </form>
    </main>
  );
}
