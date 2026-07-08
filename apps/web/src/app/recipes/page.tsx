"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageSpinner } from "../../components/PageSpinner";
import { StarRating } from "../../components/StarRating";
import { getRecipes, getSavedRecipes, toggleSaveRecipe } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { useTranslation } from "../../lib/useTranslation";
import { RecipeListItem } from "../../lib/types";
import styles from "../page.module.scss";

export default function RecipesPage() {
  const { token, isLoggedIn } = useAuth();
  const { t } = useTranslation();
  const [recipes, setRecipes] = useState<RecipeListItem[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    getRecipes()
      .then(setRecipes)
      .catch(() => setError(t("recipesUnavailable")))
      .finally(() => setLoading(false));
  }, [t]);

  useEffect(() => {
    if (!token || !isLoggedIn) {
      setSavedIds([]);
      return;
    }

    getSavedRecipes(token)
      .then((saved) => setSavedIds(saved.map((recipe) => recipe.id)))
      .catch(() => {
        setSavedIds([]);
      });
  }, [isLoggedIn, token]);

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

  return (
    <main className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <h1>{t("recipesTitle")}</h1>
          <p>{t("recipesBasicInfo")}</p>
        </div>
      </header>

      {error ? <p className={styles.error}>{error}</p> : null}
      {loading && !error ? <PageSpinner label={t("loadingRecipes")} /> : null}

      <section className={styles.grid}>
        {recipes.map((recipe) => (
          <article className={`${styles.card} ${styles.recipeCard}`} key={recipe.id}>
            <Link href={`/recipes/${recipe.id}`}>
              <h2>{recipe.title}</h2>
              <p>{recipe.shortDescription}</p>
              {recipe.postedByRecommendedUser ? (
                <p className={styles.recommendedLabel}>{t("recommendedAuthor")}</p>
              ) : null}
              <div className={styles.meta}>
                <span>{recipe.preparationTime}</span>
                <span>{recipe.servings}</span>
              </div>
              <div className={styles.cardRating}>
                <StarRating
                  averageRating={recipe.averageRating}
                  ratingsCount={recipe.ratingsCount}
                />
              </div>
              <ul>
                {recipe.ingredients.slice(0, 5).map((ingredient, idx) => (
                  <li key={`${ingredient}-${idx}`}>{ingredient}</li>
                ))}
              </ul>
            </Link>
            <div className={styles.cardFooter}>
              <Link href={`/profile/${recipe.author.id}`} className={styles.authorLink}>
                <span className={styles.avatar}>
                  {`${recipe.author.firstName}`.slice(0, 1).toUpperCase()}
                </span>
                <span>{recipe.author.firstName} {recipe.author.lastName}</span>
              </Link>
              {isLoggedIn ? (
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
              ) : null}
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
