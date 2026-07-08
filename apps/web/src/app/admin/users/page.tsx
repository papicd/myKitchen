"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageSpinner } from "../../../components/PageSpinner";
import { getUsers, updateUserRecommendation } from "../../../lib/api";
import { useAuth } from "../../../lib/auth";
import { useTranslation } from "../../../lib/useTranslation";
import { AdminUser } from "../../../lib/types";
import pageStyles from "../../page.module.scss";
import styles from "./page.module.scss";

export default function AdminUsersPage() {
  const { user, token, isLoggedIn } = useAuth();
  const { t } = useTranslation();
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
      .catch((err) => setError(err instanceof Error ? err.message : t("cannotLoadUsers")))
      .finally(() => setLoading(false));
  }, [token, user?.isAdmin, t]);

  async function toggleRecommendation(target: AdminUser) {
    if (!token) return;

    setBusyId(target.id);
    setError("");

    try {
      const updated = await updateUserRecommendation(target.id, !target.isRecommended, token);
      setUsers((prev) => prev.map((entry) => (entry.id === updated.id ? { ...entry, ...updated } : entry)));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("updateRecommendationFailed"));
    } finally {
      setBusyId(null);
    }
  }

  if (!isLoggedIn) {
    return (
      <main className={pageStyles.page}>
        <section className={pageStyles.card}>
          <h1>{t("adminRequired")}</h1>
          <div className={pageStyles.actions}>
            <Link href="/login">{t("login")}</Link>
          </div>
        </section>
      </main>
    );
  }

  if (!user?.isAdmin) {
    return (
      <main className={pageStyles.page}>
        <section className={pageStyles.card}>
          <h1>{t("adminOnly")}</h1>
          <div className={pageStyles.actions}>
            <Link href="/">{t("backToHome")}</Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className={pageStyles.page}>
      <header className={pageStyles.pageHeader}>
        <div>
          <h1>{t("recommendedUsers")}</h1>
          <p>{t("recommendedUsersDescription")}</p>
        </div>
      </header>

      <section className={pageStyles.card}>
        {error ? <p className={pageStyles.error}>{error}</p> : null}
        {loading ? <PageSpinner label={t("loadingUsers")} /> : null}

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
                      {entry.isAdmin ? <span className={styles.badge}>{t("admin")}</span> : null}
                      {entry.isRecommended ? (
                        <span className={`${styles.badge} ${styles.recommended}`}>{t("recommendedAuthor")}</span>
                      ) : null}
                      <span className={styles.badge}>{entry.recipeCount} {t("recipeCount")}</span>
                    </div>
                    {isSelf ? (
                      <span className={styles.selfNote}>{t("cannotRecommendSelf")}</span>
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
                        ? t("saving")
                        : entry.isRecommended
                          ? t("removeRecommendation")
                          : t("recommendAuthor")}
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

