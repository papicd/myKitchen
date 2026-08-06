"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Avatar } from "../../components/Avatar";
import { PageSpinner } from "../../components/PageSpinner";
import { RecipeTypeBadges } from "../../components/RecipeTypeBadges";
import { StarRating } from "../../components/StarRating";
import {
  addRecipeToCollection,
  getRatedRecipes,
  getRecipeCollections,
  getSavedRecipes,
  rateRecipe,
  toggleSaveRecipe,
} from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { useTranslation } from "../../lib/useTranslation";
import { RecipeListItem } from "../../lib/types";
import styles from "../page.module.scss";

type Tab = "saved" | "rated";

export default function MyRecipesPage() {
  const { token, isLoggedIn, showApiError, showSuccess } = useAuth();
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>("saved");
  const [savedRecipes, setSavedRecipes] = useState<RecipeListItem[]>([]);
  const [ratedRecipes, setRatedRecipes] = useState<RecipeListItem[]>([]);
  const [collections, setCollections] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busySaveId, setBusySaveId] = useState<string | null>(null);
  const [busyRateId, setBusyRateId] = useState<string | null>(null);
  const [busyCollectionId, setBusyCollectionId] = useState<string | null>(null);
  const [selectedCollectionByRecipe, setSelectedCollectionByRecipe] = useState<Record<string, string>>({});
  const [openCollectionPickerRecipeId, setOpenCollectionPickerRecipeId] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !isLoggedIn) {
      setLoading(false);
      return;
    }

    Promise.all([
      getSavedRecipes(token),
      getRatedRecipes(token),
      getRecipeCollections(token),
    ])
      .then(([saved, rated, collectionItems]) => {
        setSavedRecipes(saved);
        setRatedRecipes(rated);
        setCollections(collectionItems.map((collection) => ({ id: collection.id, name: collection.name })));
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : t("cannotLoadRecipe"));
        showApiError(err, t("cannotLoadRecipe"));
      })
      .finally(() => setLoading(false));
  }, [isLoggedIn, showApiError, token, t]);

  const savedIds = useMemo(() => savedRecipes.map((recipe) => recipe.id), [savedRecipes]);
  async function handleToggleSave(recipeId: string) {
    if (!token) return;

    setBusySaveId(recipeId);

    try {
      const result = await toggleSaveRecipe(recipeId, token);

      if (!result.saved) {
        setSavedRecipes((prev) => prev.filter((recipe) => recipe.id !== recipeId));
      } else {
        const refreshed = await getSavedRecipes(token);
        setSavedRecipes(refreshed);
      }
      showSuccess(t(result.saved ? "recipeSavedToCollection" : "recipeRemovedFromCollection"));
    } catch (err) {
      showApiError(err, t("saveFailed"));
    } finally {
      setBusySaveId(null);
    }
  }

  async function handleRate(recipeId: string, value: number) {
    if (!token) return;

    setBusyRateId(recipeId);

    try {
      const updatedRecipe = await rateRecipe(recipeId, value, token);

      setRatedRecipes((prev) =>
        prev.map((recipe) =>
          recipe.id === recipeId
            ? {
                ...recipe,
                averageRating: updatedRecipe.averageRating,
                ratingsCount: updatedRecipe.ratingsCount,
                currentUserRating: updatedRecipe.currentUserRating ?? undefined,
              }
            : recipe,
        ),
      );
      showSuccess(t("ratingSavedSuccess"));
    } catch (err) {
      showApiError(err, t("ratingNotSaved"));
    } finally {
      setBusyRateId(null);
    }
  }

  async function handleAddToCollection(recipeId: string) {
    if (!token) return;
    const collectionId = selectedCollectionByRecipe[recipeId];
    if (!collectionId) return;

    setBusyCollectionId(collectionId);
    try {
      const updated = await addRecipeToCollection(collectionId, recipeId, token);
      setCollections((prev) => prev.map((collection) => (collection.id === collectionId ? updated : collection)));
      showSuccess(t("recipeAddedToNamedCollection", { name: updated.name }));
    } catch (err) {
      showApiError(err, t("collectionAddRecipeFailed"));
    } finally {
      setBusyCollectionId(null);
    }
  }

  function getSelectedCollectionName(recipeId: string) {
    const selectedId = selectedCollectionByRecipe[recipeId];
    if (!selectedId) return t("chooseCollection");
    const selected = collections.find((collection) => collection.id === selectedId);
    return selected?.name ?? t("chooseCollection");
  }

  if (!isLoggedIn) {
    return (
      <main className={styles.page}>
        <section className={styles.card}>
          <h1>{t("myRecipesNotAvailable")}</h1>
          <div className={styles.actions}>
            <Link href="/login">{t("login")}</Link>
          </div>
        </section>
      </main>
    );
  }

  const recipes = tab === "saved" ? savedRecipes : ratedRecipes;

  return (
    <main className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <h1>{t("myRecipesTitle")}</h1>
          <p>{t("myRecipesDescription")}</p>
        </div>
      </header>

      <section className={styles.card}>
        <div className={styles.tabRow}>
          <button
            type="button"
            className={`${styles.tabBtn} ${tab === "saved" ? styles.tabBtnActive : ""}`}
            onClick={() => setTab("saved")}
          >
            {t("savedRecipes", { count: savedRecipes.length })}
          </button>
          <button
            type="button"
            className={`${styles.tabBtn} ${tab === "rated" ? styles.tabBtnActive : ""}`}
            onClick={() => setTab("rated")}
          >
            {t("ratedRecipes", { count: ratedRecipes.length })}
          </button>
          </div>

        {error ? <p className={styles.error}>{error}</p> : null}
        {loading ? <PageSpinner label={t("loadingMyRecipes")} /> : null}

        {!loading && (tab === "saved" || tab === "rated") && recipes.length === 0 ? (
          <p className={styles.muted}>
            {tab === "saved" ? t("noSavedRecipes") : t("noRatedRecipes")}
          </p>
        ) : null}

        {!loading && (tab === "saved" || tab === "rated") && recipes.length > 0 ? (
          <div className={styles.grid}>
            {recipes.map((recipe) => (
              <article key={recipe.id} className={`${styles.card} ${styles.recipeCard}`}>
                <Link href={`/recipes/${recipe.id}`}>
                  <h2>{recipe.title}</h2>
                  <p>{recipe.shortDescription}</p>
                  <RecipeTypeBadges types={recipe.types} maxVisible={3} />
                  {recipe.postedByRecommendedUser ? (
                    <p className={styles.recommendedLabel}>{t("recommendedAuthor")}</p>
                  ) : null}
                  {recipe.preparationTime || recipe.servings ? (
                    <div className={styles.meta}>
                      {recipe.preparationTime ? <span>{recipe.preparationTime}</span> : null}
                      {recipe.servings ? <span>{recipe.servings}</span> : null}
                    </div>
                  ) : null}
                  <div className={styles.cardRating}>
                    <StarRating
                      averageRating={recipe.averageRating}
                      ratingsCount={recipe.ratingsCount}
                      currentUserRating={recipe.currentUserRating}
                      interactive={tab === "rated"}
                      disabled={busyRateId === recipe.id}
                      onRate={(value) => handleRate(recipe.id, value)}
                      helperText={
                        tab === "rated"
                          ? recipe.currentUserRating
                            ? t("yourRating", { rating: recipe.currentUserRating })
                            : t("clickToRate")
                          : undefined
                      }
                    />
                  </div>
                </Link>
                <div className={styles.cardFooter}>
                  <Link href={`/profile/${recipe.author.id}`} className={styles.authorLink}>
                    <Avatar
                      name={recipe.author.username}
                      avatarUrl={recipe.author.avatarUrl}
                      className={styles.avatar}
                    />
                    <span>@{recipe.author.username}</span>
                  </Link>
                  <div className={styles.cardActions}>
                    <button
                      type="button"
                      className={`${styles.saveBtn} ${savedIds.includes(recipe.id) ? styles.saveBtnActive : ""}`}
                      disabled={busySaveId === recipe.id}
                      onClick={() => handleToggleSave(recipe.id)}
                    >
                      {busySaveId === recipe.id
                        ? "..."
                        : savedIds.includes(recipe.id)
                          ? t("saved")
                          : t("save")}
                    </button>
                  </div>
                </div>
                {tab === "saved" && collections.length > 0 ? (
                  <div className={styles.collectionPickerRow}>
                    <div className={styles.collectionPicker}>
                      <button
                        type="button"
                        className={styles.collectionPickerTrigger}
                        onClick={() =>
                          setOpenCollectionPickerRecipeId((current) => (current === recipe.id ? null : recipe.id))
                        }
                      >
                        <span>{getSelectedCollectionName(recipe.id)}</span>
                        <span aria-hidden="true">▾</span>
                      </button>
                      {openCollectionPickerRecipeId === recipe.id ? (
                        <div className={styles.collectionPickerMenu}>
                          {collections.map((collection) => (
                            <button
                              key={collection.id}
                              type="button"
                              className={`${styles.collectionPickerItem} ${
                                selectedCollectionByRecipe[recipe.id] === collection.id
                                  ? styles.collectionPickerItemActive
                                  : ""
                              }`}
                              onClick={() => {
                                setSelectedCollectionByRecipe((current) => ({
                                  ...current,
                                  [recipe.id]: collection.id,
                                }));
                                setOpenCollectionPickerRecipeId(null);
                              }}
                            >
                              {collection.name}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      className={styles.collectionAddButton}
                      onClick={() => {
                        setOpenCollectionPickerRecipeId(null);
                        handleAddToCollection(recipe.id);
                      }}
                      disabled={!selectedCollectionByRecipe[recipe.id] || busyCollectionId !== null}
                    >
                      {t("addToCollection")}
                    </button>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        ) : null}

      </section>
    </main>
  );
}
