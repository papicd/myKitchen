"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageSpinner } from "../../../components/PageSpinner";
import { getUsers, updateUserRecommendation } from "../../../lib/api";
import { useAuth } from "../../../lib/auth";
import { AdminUser } from "../../../lib/types";
import pageStyles from "../../page.module.scss";
import styles from "./page.module.scss";

export default function AdminUsersPage() {
  const { user, token, isLoggedIn } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token || !user?.isAdmin) {
      setLoading(false);
      return;
    }

    getUsers(token)
      .then(setUsers)
      .catch((err) => setError(err instanceof Error ? err.message : "Nije moguce ucitati korisnike"))
      .finally(() => setLoading(false));
  }, [token, user?.isAdmin]);

  async function toggleRecommendation(target: AdminUser) {
    if (!token) return;

    setBusyId(target.id);
    setError("");

    try {
      const updated = await updateUserRecommendation(target.id, !target.isRecommended, token);
      setUsers((prev) => prev.map((entry) => (entry.id === updated.id ? { ...entry, ...updated } : entry)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Izmena preporuke nije uspela");
    } finally {
      setBusyId(null);
    }
  }

  if (!isLoggedIn) {
    return (
      <main className={pageStyles.page}>
        <section className={pageStyles.card}>
          <h1>Admin sekcija zahteva prijavu</h1>
          <div className={pageStyles.actions}>
            <Link href="/login">Prijava</Link>
          </div>
        </section>
      </main>
    );
  }

  if (!user?.isAdmin) {
    return (
      <main className={pageStyles.page}>
        <section className={pageStyles.card}>
          <h1>Ova stranica je dostupna samo administratoru</h1>
          <div className={pageStyles.actions}>
            <Link href="/">Nazad na pocetnu</Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className={pageStyles.page}>
      <header className={pageStyles.pageHeader}>
        <div>
          <h1>Preporuceni korisnici</h1>
          <p>Administrator moze oznaciti autore ciji ce recepti biti posebno istaknuti.</p>
        </div>
      </header>

      <section className={pageStyles.card}>
        {error ? <p className={pageStyles.error}>{error}</p> : null}
        {loading ? <PageSpinner label="Ucitavanje korisnika..." /> : null}

        {!loading ? (
          <div className={styles.list}>
            {users.map((entry) => {
              const isSelf = entry.id === user.id;
              const isBusy = busyId === entry.id;

              return (
                <article key={entry.id} className={`${pageStyles.card} ${styles.userRow}`}>
                  <div className={styles.userInfo}>
                    <h2 className={styles.userName}>
                      {entry.firstName} {entry.lastName}
                    </h2>
                    <p className={pageStyles.muted}>
                      @{entry.username} · {entry.email}
                    </p>
                    <div className={styles.meta}>
                      {entry.isAdmin ? <span className={styles.badge}>Admin</span> : null}
                      {entry.isRecommended ? (
                        <span className={`${styles.badge} ${styles.recommended}`}>Preporucen autor</span>
                      ) : null}
                      <span className={styles.badge}>{entry.recipeCount} recepta</span>
                    </div>
                    {isSelf ? (
                      <span className={styles.selfNote}>Ne mozes preporuciti sopstveni nalog.</span>
                    ) : null}
                  </div>

                  <div className={styles.actions}>
                    <button
                      type="button"
                      className={entry.isRecommended ? styles.secondary : styles.primary}
                      onClick={() => toggleRecommendation(entry)}
                      disabled={isSelf || isBusy}
                    >
                      {isBusy
                        ? "Cuvanje..."
                        : entry.isRecommended
                          ? "Ukloni preporuku"
                          : "Preporuci autora"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : null}
      </section>
    </main>
  );
}

