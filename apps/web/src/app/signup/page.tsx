"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { signup } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import styles from "../page.module.scss";

export default function SignupPage() {
  const router = useRouter();
  const { saveAuth } = useAuth();
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
          : "Registracija nije uspela",
      );
    }
  }

  return (
    <main className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <h1>Registracija</h1>
          <p>Napravi nalog za dodavanje recepata i pretragu po namirnicama.</p>
        </div>
      </header>

      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.field}>
          <label htmlFor="firstName">Ime</label>
          <input id="firstName" name="firstName" required />
        </div>
        <div className={styles.field}>
          <label htmlFor="lastName">Prezime</label>
          <input id="lastName" name="lastName" required />
        </div>
        <div className={styles.field}>
          <label htmlFor="username">Korisnicko ime</label>
          <input id="username" name="username" required />
        </div>
        <div className={styles.field}>
          <label htmlFor="email">Email</label>
          <input id="email" name="email" required type="email" />
        </div>
        <div className={styles.field}>
          <label htmlFor="password">Lozinka</label>
          <input id="password" name="password" required type="password" />
        </div>
        {error ? <p className={styles.error}>{error}</p> : null}
        <button className={styles.button}>Registruj se</button>
      </form>
    </main>
  );
}
