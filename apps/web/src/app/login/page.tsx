"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { login } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import styles from "../page.module.scss";

export default function LoginPage() {
  const router = useRouter();
  const { saveAuth } = useAuth();
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const formData = new FormData(event.currentTarget);

    try {
      const auth = await login(
        String(formData.get("email")),
        String(formData.get("password")),
      );
      saveAuth(auth);
      router.push("/");
    } catch (loginError) {
      setError(
        loginError instanceof Error ? loginError.message : "Prijava nije uspela",
      );
    }
  }

  return (
    <main className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <h1>Prijava</h1>
          <p>Koristi nalog da vidis detalje recepata i dodajes svoje recepte.</p>
        </div>
      </header>

      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.field}>
          <label htmlFor="email">Email</label>
          <input id="email" name="email" required type="email" />
        </div>
        <div className={styles.field}>
          <label htmlFor="password">Lozinka</label>
          <input id="password" name="password" required type="password" />
        </div>
        {error ? <p className={styles.error}>{error}</p> : null}
        <button className={styles.button}>Prijavi se</button>
      </form>

      <p className={styles.muted}>
        Nemas nalog? <Link href="/signup">Registruj se</Link>
      </p>
    </main>
  );
}
