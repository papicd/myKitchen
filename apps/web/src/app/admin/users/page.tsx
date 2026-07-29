"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { PageSpinner } from "../../../components/PageSpinner";
import { createRecipeType, getRecipeTypes, getUsers, updateUserRecommendation, updateUserAdmin } from "../../../lib/api";
import { useAuth } from "../../../lib/auth";
import { useTranslation } from "../../../lib/useTranslation";
import { AdminUser, RecipeType } from "../../../lib/types";
import pageStyles from "../../page.module.scss";
import styles from "./page.module.scss";

const USERS_PAGE_SIZE = 10;

type AdminTab = "users" | "types";

export default function AdminUsersPage() {
  const { user, token, isLoggedIn, showApiError, showSuccess } = useAuth();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<AdminTab>("users");

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [busyAdminId, setBusyAdminId] = useState<string | null>(null);
  const [usersError, setUsersError] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [userQuery, setUserQuery] = useState("");
  const [userPage, setUserPage] = useState(1);
  const [userTotal, setUserTotal] = useState(0);
  const [userTotalPages, setUserTotalPages] = useState(1);

  const [recipeTypes, setRecipeTypes] = useState<RecipeType[]>([]);
  const [loadingTypes, setLoadingTypes] = useState(false);
  const [typesError, setTypesError] = useState("");
  const [creatingType, setCreatingType] = useState(false);
  const [newTypeName, setNewTypeName] = useState("");
  const [newTypeColor, setNewTypeColor] = useState("#22C55E");

  useEffect(() => {
    if (!token || !user?.isAdmin || activeTab !== "users") {
      setLoadingUsers(false);
      return;
    }

    setLoadingUsers(true);
    setUsersError("");

    getUsers(token, { query: userQuery || undefined, page: userPage, limit: USERS_PAGE_SIZE })
      .then((response) => {
        setUsers(response.items);
        setUserTotal(response.total);
        setUserPage(response.page);
        setUserTotalPages(response.totalPages);
      })
      .catch((err) => {
        setUsersError(err instanceof Error ? err.message : t("cannotLoadUsers"));
        showApiError(err, t("cannotLoadUsers"));
      })
      .finally(() => setLoadingUsers(false));
  }, [activeTab, showApiError, token, user?.isAdmin, userPage, userQuery, t]);

  useEffect(() => {
    if (!token || !user?.isAdmin || activeTab !== "types") {
      return;
    }

    setLoadingTypes(true);
    setTypesError("");

    getRecipeTypes()
      .then(setRecipeTypes)
      .catch((err) => {
        setTypesError(err instanceof Error ? err.message : t("cannotLoadRecipeTypes"));
        showApiError(err, t("cannotLoadRecipeTypes"));
      })
      .finally(() => setLoadingTypes(false));
  }, [activeTab, showApiError, token, user?.isAdmin, t]);

  async function toggleAdmin(target: AdminUser) {
    if (!token) return;

    setBusyAdminId(target.id);
    setUsersError("");

    try {
      const updated = await updateUserAdmin(target.id, !target.isAdmin, token);
      setUsers((prev) => prev.map((entry) => (entry.id === updated.id ? { ...entry, ...updated } : entry)));
      showSuccess(t("adminUpdatedSuccess"));
    } catch (err) {
      showApiError(err, t("updateAdminFailed"));
    } finally {
      setBusyAdminId(null);
    }
  }

  async function toggleRecommendation(target: AdminUser) {
    if (!token) return;

    setBusyId(target.id);
    setUsersError("");

    try {
      const updated = await updateUserRecommendation(target.id, !target.isRecommended, token);
      setUsers((prev) => prev.map((entry) => (entry.id === updated.id ? { ...entry, ...updated } : entry)));
      showSuccess(t("recommendationUpdatedSuccess"));
    } catch (err) {
      showApiError(err, t("updateRecommendationFailed"));
    } finally {
      setBusyId(null);
    }
  }

  async function handleTypeCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;

    setCreatingType(true);
    setTypesError("");

    try {
      const created = await createRecipeType({ name: newTypeName, color: newTypeColor }, token);
      setRecipeTypes((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      setNewTypeName("");
      showSuccess(t("recipeTypeCreated"));
    } catch (err) {
      showApiError(err, t("cannotCreateRecipeType"));
    } finally {
      setCreatingType(false);
    }
  }

  function submitUserSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUserPage(1);
    setUserQuery(searchInput.trim());
  }

  function clearUserSearch() {
    setSearchInput("");
    setUserQuery("");
    setUserPage(1);
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
          <h1>{t("adminPanel")}</h1>
          <p>{t("adminPanelDescription")}</p>
        </div>
      </header>

      <section className={pageStyles.card}>
        <div className={styles.tabs}>
          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === "users" ? styles.tabBtnActive : ""}`}
            onClick={() => setActiveTab("users")}
          >
            {t("adminUsersTab")}
          </button>
          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === "types" ? styles.tabBtnActive : ""}`}
            onClick={() => setActiveTab("types")}
          >
            {t("adminRecipeTypesTab")}
          </button>
        </div>

        {activeTab === "users" ? (
          <div className={styles.tabPanel}>
            <form className={styles.searchBar} onSubmit={submitUserSearch}>
              <label htmlFor="adminUserSearch" className={styles.searchLabel}>
                {t("searchUsersLabel")}
              </label>
              <div className={styles.searchActions}>
                <input
                  id="adminUserSearch"
                  type="search"
                  value={searchInput}
                  placeholder={t("searchUsersPlaceholder")}
                  onChange={(event) => setSearchInput(event.target.value)}
                />
                <button type="submit" className={styles.primary}>{t("search")}</button>
                <button type="button" className={styles.secondary} onClick={clearUserSearch}>
                  {t("clear")}
                </button>
              </div>
            </form>

            <p className={pageStyles.muted}>{t("adminUsersFound", { count: userTotal })}</p>

            {usersError ? <p className={pageStyles.error}>{usersError}</p> : null}
            {loadingUsers ? <PageSpinner label={t("loadingUsers")} /> : null}

            {!loadingUsers && users.length === 0 ? <p className={pageStyles.muted}>{t("noUsersFound")}</p> : null}

            {!loadingUsers && users.length > 0 ? (
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
                        <button
                          type="button"
                          className={entry.isAdmin ? styles.secondary : styles.primary}
                          onClick={() => toggleAdmin(entry)}
                          disabled={isSelf || busyAdminId === entry.id}
                        >
                          {busyAdminId === entry.id
                            ? t("saving")
                            : entry.isAdmin
                              ? t("removeAdmin")
                              : t("assignAdmin")}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : null}

            {!loadingUsers && userTotalPages > 1 ? (
              <div className={styles.pagination}>
                <button
                  type="button"
                  className={styles.secondary}
                  disabled={userPage <= 1}
                  onClick={() => setUserPage((value) => Math.max(1, value - 1))}
                >
                  {t("previous")}
                </button>
                <span className={styles.pageInfo}>{t("adminUsersPagination", { page: userPage, totalPages: userTotalPages })}</span>
                <button
                  type="button"
                  className={styles.secondary}
                  disabled={userPage >= userTotalPages}
                  onClick={() => setUserPage((value) => Math.min(userTotalPages, value + 1))}
                >
                  {t("next")}
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        {activeTab === "types" ? (
          <div className={styles.tabPanel}>
            <p className={pageStyles.muted}>{t("recipeTypesAdminDescription")}</p>

            <form className={styles.typeForm} onSubmit={handleTypeCreate}>
              <label>
                <span>{t("recipeTypeNameLabel")}</span>
                <input
                  value={newTypeName}
                  onChange={(event) => setNewTypeName(event.target.value)}
                  placeholder={t("recipeTypeNamePlaceholder")}
                  required
                />
              </label>
              <label>
                <span>{t("recipeTypeColorLabel")}</span>
                <input
                  type="color"
                  value={newTypeColor}
                  onChange={(event) => setNewTypeColor(event.target.value)}
                  required
                />
              </label>
              <button type="submit" className={styles.primary} disabled={creatingType}>
                {creatingType ? t("saving") : t("addRecipeTypeButton")}
              </button>
            </form>

            {typesError ? <p className={pageStyles.error}>{typesError}</p> : null}
            {loadingTypes ? <PageSpinner label={t("loadingRecipeTypes")} /> : null}

            {!loadingTypes ? (
              <div className={styles.typesList}>
                {recipeTypes.map((type) => (
                  <article key={type.id} className={styles.typeRow}>
                    <span className={styles.typeSwatch} style={{ backgroundColor: type.color }} aria-hidden="true" />
                    <div>
                      <p className={styles.typeName}>{type.name}</p>
                      <p className={pageStyles.muted}>{type.color}</p>
                    </div>
                  </article>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </section>
    </main>
  );
}
