"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { RecipeTypeBadges } from "../../components/RecipeTypeBadges";
import { getSavedRecipes, searchRecipes, toggleSaveRecipe } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { useTranslation } from "../../lib/useTranslation";
import { RecipeListItem } from "../../lib/types";
import styles from "../page.module.scss";

export default function FindPage() {
  const { token, isLoggedIn } = useAuth();
  const { t } = useTranslation();
  const [recipes, setRecipes] = useState<RecipeListItem[]>([]);
  const [error, setError] = useState("");
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!token) {
      setError(t("mustBeLogged"));
      return;
    }

    const formData = new FormData(event.currentTarget);
    const query = String(formData.get("groceries"));

    try {
      const foundRecipes = await searchRecipes(query, token);
      setRecipes(foundRecipes);
      const savedRecipes = await getSavedRecipes(token);
      setSavedIds(savedRecipes.map((recipe) => recipe.id));
    } catch (searchError) {
      setError(
        searchError instanceof Error
          ? searchError.message
          : t("searchFailed"),
      );
    }
  }

  async function handleSave(recipeId: string) {
    if (!token) {
      return;
    }

    setSavingId(recipeId);

    try {
      const result = await toggleSaveRecipe(recipeId, token);
      setSavedIds((prev) => {
        const hasRecipe = prev.includes(recipeId);

        if (result.saved && !hasRecipe) {
          return [...prev, recipeId];
        }

        if (!result.saved && hasRecipe) {
          return prev.filter((id) => id !== recipeId);
        }

        return prev;
      });
    } finally {
      setSavingId(null);
    }
  }

  if (!isLoggedIn) {
    return (
      <main className={styles.page}>
        <section className={styles.card}>
          <h1>{t("searchAvailableAfterLogin")}</h1>
          <p className={styles.muted}>{t("loginAndSearch")}</p>
          <div className={styles.actions}>
            <Link href="/login">{t("login")}</Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <h1>{t("findTitle")}</h1>
          <p>{t("findDescription")}</p>
        </div>
      </header>

      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.field}>
          <label htmlFor="groceries">{t("ingredientsFieldLabel")}</label>
          <input id="groceries" name="groceries" placeholder={t("ingredientsFieldPlaceholder")} />
        </div>
        <button className={styles.button}>{t("searchButton")}</button>
      </form>

      {error ? <p className={styles.error}>{error}</p> : null}

      <section className={styles.grid}>
        {recipes.map((recipe) => (
          <article className={`${styles.card} ${styles.recipeCard}`} key={recipe.id}>
            <Link href={`/recipes/${recipe.id}`}>
              <h2>{recipe.title}</h2>
              <p>{recipe.shortDescription}</p>
              <RecipeTypeBadges types={recipe.types} maxVisible={3} />
              <div className={styles.meta}>
                <span>{t("matches", { count: recipe.matchedGroceries ?? 0 })}</span>
              </div>
            </Link>
            <div className={styles.cardFooter}>
              <Link href={`/profile/${recipe.author.id}`} className={styles.authorLink}>
                <span className={styles.avatar}>
                  {`${recipe.author.username}`.slice(0, 1).toUpperCase()}
                </span>
                <span>@{recipe.author.username}</span>
              </Link>
              <div className={styles.cardActions}>
                <button
                  type="button"
                  className={`${styles.saveBtn} ${savedIds.includes(recipe.id) ? styles.saveBtnActive : ""}`}
                  disabled={savingId === recipe.id}
                  onClick={() => handleSave(recipe.id)}
                >
                  {savingId === recipe.id
                    ? "..."
                    : savedIds.includes(recipe.id)
                      ? t("saved")
                      : t("save")}
                </button>
              </div>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
