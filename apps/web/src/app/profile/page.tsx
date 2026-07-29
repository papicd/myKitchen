"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { PageSpinner } from "../../components/PageSpinner";
import { RecipeTypeBadges } from "../../components/RecipeTypeBadges";
import { deleteRecipe, getMyRecipes, updateMyProfile } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { useTranslation } from "../../lib/useTranslation";
import { RecipeListItem } from "../../lib/types";
import styles from "../page.module.scss";

type ProfileForm = {
  firstName: string;
  lastName: string;
  username: string;
  email: string;
};

type PasswordForm = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

export default function ProfilePage() {
  const { user, token, isLoggedIn, saveAuth, showApiError, showSuccess } = useAuth();
  const { t } = useTranslation();
  const [recipes, setRecipes] = useState<RecipeListItem[]>([]);
  const [recipeError, setRecipeError] = useState("");
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [profileForm, setProfileForm] = useState<ProfileForm>({
    firstName: "",
    lastName: "",
    username: "",
    email: "",
  });
  const [passwordForm, setPasswordForm] = useState<PasswordForm>({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [profileSaving, setProfileSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  useEffect(() => {
    if (!user) return;

    setProfileForm({
      firstName: user.firstName,
      lastName: user.lastName,
      username: user.username,
      email: user.email,
    });
  }, [user]);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    getMyRecipes(token)
      .then(setRecipes)
      .catch((err) => {
        setRecipeError(t("cannotLoadUserRecipes"));
        showApiError(err, t("cannotLoadUserRecipes"));
      })
      .finally(() => setLoading(false));
  }, [showApiError, token, t]);

  async function handleProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;

    setProfileSaving(true);

    try {
      const auth = await updateMyProfile(profileForm, token);
      saveAuth(auth);
      showSuccess(t("profileUpdated"));
    } catch (err) {
      showApiError(err, t("profileUpdateFailed"));
    } finally {
      setProfileSaving(false);
    }
  }

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;

    setPasswordError("");

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError(t("passwordsDoNotMatch"));
      return;
    }

    setPasswordSaving(true);

    try {
      const auth = await updateMyProfile(
        {
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        },
        token,
      );
      saveAuth(auth);
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      showSuccess(t("passwordUpdated"));
    } catch (err) {
      showApiError(err, t("passwordUpdateFailed"));
    } finally {
      setPasswordSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteId || !token) return;
    setDeleting(true);
    try {
      await deleteRecipe(deleteId, token);
      // Refresh the recipes list from the server
      const updatedRecipes = await getMyRecipes(token);
      setRecipes(updatedRecipes);
      setDeleteId(null);
      showSuccess(t("recipeDeletedSuccess"));
    } catch (err) {
      setDeleteId(null);
      showApiError(err, t("deleteError"));
    } finally {
      setDeleting(false);
    }
  }

  if (!isLoggedIn || !user) {
    return (
      <main className={styles.page}>
        <section className={styles.card}>
          <h1>{t("profileNotAvailable")}</h1>
          <div className={styles.actions}>
            <Link href="/login">{t("login")}</Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <>
      {deleteId ? (
        <ConfirmDialog
          title={t("deleteRecipeTitle")}
          description={t("deleteConfirmMessage")}
          confirmLabel={t("deleteRecipeButton")}
          loading={deleting}
          onConfirm={handleDelete}
          onCancel={() => setDeleteId(null)}
        />
      ) : null}

      <main className={styles.page}>
        <header className={styles.pageHeader}>
          <div>
            <h1>{t("profileTitle")}</h1>
            <p>
              {t("profileDescription")}
            </p>
          </div>
        </header>

        <section className={styles.profileOverview}>
          <article className={styles.profileHeroCard}>
            <span className={styles.profileAvatar}>
              {`${user.username}`.slice(0, 1).toUpperCase()}
            </span>
            <div>
              <h2>@{user.username}</h2>
              <p>{user.email}</p>
            </div>
          </article>
          <div className={styles.profileStats}>
            <article>
              <strong>{recipes.length}</strong>
              <span>{t("myRecipesSection")}</span>
            </article>
            <article>
              <strong>{user.isAdmin ? t("yes") : t("no")}</strong>
              <span>{t("admin")}</span>
            </article>
            <article>
              <strong>{user.isRecommended ? t("yes") : t("no")}</strong>
              <span>{t("recommendedAuthor")}</span>
            </article>
          </div>
        </section>

        <section className={styles.profileSettingsGrid}>
          <article className={styles.card}>
            <h2>{t("accountDetails")}</h2>
            <p className={styles.hint}>{t("accountDetailsHint")}</p>
            <form className={styles.form} onSubmit={handleProfileSubmit}>
              <div className={styles.field}>
                <label htmlFor="firstName">{t("firstName")}</label>
                <input
                  id="firstName"
                  value={profileForm.firstName}
                  onChange={(event) => setProfileForm((current) => ({ ...current, firstName: event.target.value }))}
                  required
                />
              </div>
              <div className={styles.field}>
                <label htmlFor="lastName">{t("lastName")}</label>
                <input
                  id="lastName"
                  value={profileForm.lastName}
                  onChange={(event) => setProfileForm((current) => ({ ...current, lastName: event.target.value }))}
                  required
                />
              </div>
              <div className={styles.field}>
                <label htmlFor="username">{t("username")}</label>
                <input
                  id="username"
                  value={profileForm.username}
                  onChange={(event) => setProfileForm((current) => ({ ...current, username: event.target.value }))}
                  required
                />
              </div>
              <div className={styles.field}>
                <label htmlFor="email">{t("email")}</label>
                <input
                  id="email"
                  type="email"
                  value={profileForm.email}
                  onChange={(event) => setProfileForm((current) => ({ ...current, email: event.target.value }))}
                  required
                />
              </div>
              <button className={styles.button} type="submit" disabled={profileSaving}>
                {profileSaving ? t("saving") : t("saveChangesButton")}
              </button>
            </form>
          </article>

          <article className={styles.card}>
            <h2>{t("changePassword")}</h2>
            <p className={styles.hint}>{t("changePasswordHint")}</p>
            <form className={styles.form} onSubmit={handlePasswordSubmit}>
              <div className={styles.field}>
                <label htmlFor="currentPassword">{t("currentPassword")}</label>
                <input
                  id="currentPassword"
                  type="password"
                  value={passwordForm.currentPassword}
                  onChange={(event) => setPasswordForm((current) => ({ ...current, currentPassword: event.target.value }))}
                  required
                />
              </div>
              <div className={styles.field}>
                <label htmlFor="newPassword">{t("newPassword")}</label>
                <input
                  id="newPassword"
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={(event) => setPasswordForm((current) => ({ ...current, newPassword: event.target.value }))}
                  required
                  minLength={2}
                />
              </div>
              <div className={styles.field}>
                <label htmlFor="confirmPassword">{t("confirmPassword")}</label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={(event) => setPasswordForm((current) => ({ ...current, confirmPassword: event.target.value }))}
                  required
                  minLength={2}
                />
              </div>
              {passwordError ? <p className={styles.error}>{passwordError}</p> : null}
              <button className={styles.button} type="submit" disabled={passwordSaving}>
                {passwordSaving ? t("saving") : t("updatePassword")}
              </button>
            </form>
          </article>
        </section>

        <section className={styles.card}>
          <h2>{t("myRecipesSection")}</h2>
          {recipeError ? <p className={styles.error}>{recipeError}</p> : null}
          {loading && !recipeError ? <PageSpinner label={t("loadingMyRecipes")} /> : null}
          {!loading ? (
            recipes.length === 0 ? (
              <p className={styles.muted}>{t("noRecipesAdded")}</p>
            ) : (
            <div className={styles.grid}>
              {recipes.map((recipe) => (
                <div key={recipe.id} className={styles.cardWrapper}>
                  <Link
                    className={`${styles.card} ${styles.recipeCard}`}
                    href={`/recipes/${recipe.id}`}
                  >
                    <h3>{recipe.title}</h3>
                    <p>{recipe.shortDescription}</p>
                    <RecipeTypeBadges types={recipe.types} maxVisible={3} />
                    <div className={styles.cardFooter}>
                      <span className={styles.authorLink}>
                        <span className={styles.avatar}>
                          {`${recipe.author.username}`.slice(0, 1).toUpperCase()}
                        </span>
                        <span>@{recipe.author.username}</span>
                      </span>
                    </div>
                  </Link>
                  <button
                    className={styles.deleteBtn}
                    type="button"
                    title={t("deleteRecipeButton")}
                    onClick={() => setDeleteId(recipe.id)}
                  >
                    🗑
                  </button>
                </div>
              ))}
            </div>
            )
          ) : null}
        </section>
      </main>
    </>
  );
}
