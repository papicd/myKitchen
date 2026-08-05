"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Avatar } from "../../components/Avatar";
import { PageSpinner } from "../../components/PageSpinner";
import { RecipeTypeBadges } from "../../components/RecipeTypeBadges";
import { StarRating } from "../../components/StarRating";
import {
  addRecipeToCollection,
  createRecipeCollection,
  deleteRecipeCollection,
  getRatedRecipes,
  getRecipeCollections,
  getSavedRecipes,
  rateRecipe,
  removeRecipeFromCollection,
  renameRecipeCollection,
  toggleSaveRecipe,
} from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { useTranslation } from "../../lib/useTranslation";
import { RecipeCollection, RecipeListItem } from "../../lib/types";
import styles from "../page.module.scss";

type Tab = "saved" | "rated" | "collections";

export default function MyRecipesPage() {
  const { token, isLoggedIn, showApiError, showSuccess } = useAuth();
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>("saved");
  const [savedRecipes, setSavedRecipes] = useState<RecipeListItem[]>([]);
  const [ratedRecipes, setRatedRecipes] = useState<RecipeListItem[]>([]);
  const [collections, setCollections] = useState<RecipeCollection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busySaveId, setBusySaveId] = useState<string | null>(null);
  const [busyRateId, setBusyRateId] = useState<string | null>(null);
  const [busyCollectionId, setBusyCollectionId] = useState<string | null>(null);
  const [collectionName, setCollectionName] = useState("");
  const [selectedCollectionByRecipe, setSelectedCollectionByRecipe] = useState<Record<string, string>>({});
  const [renameDrafts, setRenameDrafts] = useState<Record<string, string>>({});

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
        setCollections(collectionItems);
        setRenameDrafts(
          Object.fromEntries(collectionItems.map((collection) => [collection.id, collection.name])),
        );
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : t("cannotLoadRecipe"));
        showApiError(err, t("cannotLoadRecipe"));
      })
      .finally(() => setLoading(false));
  }, [isLoggedIn, showApiError, token, t]);

  const savedIds = useMemo(() => savedRecipes.map((recipe) => recipe.id), [savedRecipes]);
  const savedById = useMemo(
    () => new Map(savedRecipes.map((recipe) => [recipe.id, recipe])),
    [savedRecipes],
  );

  async function handleToggleSave(recipeId: string) {
    if (!token) return;

    setBusySaveId(recipeId);

    try {
      const result = await toggleSaveRecipe(recipeId, token);

      if (!result.saved) {
        setSavedRecipes((prev) => prev.filter((recipe) => recipe.id !== recipeId));
        setCollections((prev) =>
          prev.map((collection) => ({
            ...collection,
            recipeIds: collection.recipeIds.filter((id) => id !== recipeId),
          })),
        );
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

  async function handleCreateCollection() {
    if (!token || !collectionName.trim()) return;

    setBusyCollectionId("new");
    try {
      const created = await createRecipeCollection(collectionName, token);
      setCollections((prev) => [...prev, created]);
      setRenameDrafts((prev) => ({ ...prev, [created.id]: created.name }));
      setCollectionName("");
      showSuccess(t("collectionCreated"));
    } catch (err) {
      showApiError(err, t("collectionCreateFailed"));
    } finally {
      setBusyCollectionId(null);
    }
  }

  async function handleRenameCollection(collectionId: string) {
    if (!token) return;
    const nextName = renameDrafts[collectionId]?.trim() ?? "";
    if (!nextName) return;

    setBusyCollectionId(collectionId);
    try {
      const updated = await renameRecipeCollection(collectionId, nextName, token);
      setCollections((prev) => prev.map((collection) => (collection.id === collectionId ? updated : collection)));
      setRenameDrafts((prev) => ({ ...prev, [collectionId]: updated.name }));
      showSuccess(t("collectionRenamed"));
    } catch (err) {
      showApiError(err, t("collectionRenameFailed"));
    } finally {
      setBusyCollectionId(null);
    }
  }

  async function handleDeleteCollection(collectionId: string) {
    if (!token) return;

    setBusyCollectionId(collectionId);
    try {
      await deleteRecipeCollection(collectionId, token);
      setCollections((prev) => prev.filter((collection) => collection.id !== collectionId));
      setRenameDrafts((prev) => {
        const next = { ...prev };
        delete next[collectionId];
        return next;
      });
      showSuccess(t("collectionDeleted"));
    } catch (err) {
      showApiError(err, t("collectionDeleteFailed"));
    } finally {
      setBusyCollectionId(null);
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

  async function handleRemoveFromCollection(collectionId: string, recipeId: string) {
    if (!token) return;

    setBusyCollectionId(`${collectionId}:${recipeId}`);
    try {
      const updated = await removeRecipeFromCollection(collectionId, recipeId, token);
      setCollections((prev) => prev.map((collection) => (collection.id === collectionId ? updated : collection)));
      showSuccess(t("collectionRecipeRemoved"));
    } catch (err) {
      showApiError(err, t("collectionRemoveRecipeFailed"));
    } finally {
      setBusyCollectionId(null);
    }
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
          <button
            type="button"
            className={`${styles.tabBtn} ${tab === "collections" ? styles.tabBtnActive : ""}`}
            onClick={() => setTab("collections")}
          >
            {t("collectionsTab", { count: collections.length })}
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
                  <div className={styles.inlineActions}>
                    <select
                      value={selectedCollectionByRecipe[recipe.id] ?? ""}
                      onChange={(event) =>
                        setSelectedCollectionByRecipe((current) => ({
                          ...current,
                          [recipe.id]: event.target.value,
                        }))
                      }
                    >
                      <option value="">{t("chooseCollection")}</option>
                      {collections.map((collection) => (
                        <option key={collection.id} value={collection.id}>
                          {collection.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className={styles.subtleButton}
                      onClick={() => handleAddToCollection(recipe.id)}
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

        {!loading && tab === "collections" ? (
          <div className={styles.collectionList}>
            <div className={styles.collectionItem}>
              <div className={styles.field}>
                <label htmlFor="collectionName">{t("newCollectionName")}</label>
                <input
                  id="collectionName"
                  value={collectionName}
                  placeholder={t("collectionNamePlaceholder")}
                  onChange={(event) => setCollectionName(event.target.value)}
                />
              </div>
              <button
                type="button"
                className={styles.button}
                onClick={handleCreateCollection}
                disabled={busyCollectionId === "new" || !collectionName.trim()}
              >
                {busyCollectionId === "new" ? t("saving") : t("createCollectionButton")}
              </button>
            </div>

            {collections.length === 0 ? <p className={styles.muted}>{t("noCollections")}</p> : null}

            {collections.map((collection) => (
              <article key={collection.id} className={styles.collectionItem}>
                <div style={{ flex: 1 }}>
                  <div className={styles.inlineActions}>
                    <input
                      value={renameDrafts[collection.id] ?? collection.name}
                      onChange={(event) =>
                        setRenameDrafts((current) => ({
                          ...current,
                          [collection.id]: event.target.value,
                        }))
                      }
                    />
                    <button
                      type="button"
                      className={styles.subtleButton}
                      onClick={() => handleRenameCollection(collection.id)}
                      disabled={busyCollectionId === collection.id}
                    >
                      {t("renameCollection")}
                    </button>
                    <button
                      type="button"
                      className={styles.subtleButton}
                      onClick={() => handleDeleteCollection(collection.id)}
                      disabled={busyCollectionId === collection.id}
                    >
                      {t("delete")}
                    </button>
                  </div>
                  <p className={styles.smallMuted}>
                    {t("collectionRecipeCount", { count: collection.recipeIds.length })}
                  </p>
                  <div className={styles.collectionRecipeList}>
                    {collection.recipeIds.length === 0 ? (
                      <p className={styles.muted}>{t("collectionEmpty")}</p>
                    ) : (
                      collection.recipeIds.map((recipeId) => {
                        const recipe = savedById.get(recipeId);
                        return (
                          <div key={recipeId} className={styles.collectionRecipeItem}>
                            <div>
                              {recipe ? (
                                <>
                                  <strong>{recipe.title}</strong>
                                  <p className={styles.smallMuted}>{recipe.shortDescription}</p>
                                </>
                              ) : (
                                <strong>{t("recipeUnavailable")}</strong>
                              )}
                            </div>
                            <div className={styles.inlineActions}>
                              {recipe ? (
                                <Link className={styles.subtleButton} href={`/recipes/${recipe.id}`}>
                                  {t("viewRecipe")}
                                </Link>
                              ) : null}
                              <button
                                type="button"
                                className={styles.subtleButton}
                                onClick={() => handleRemoveFromCollection(collection.id, recipeId)}
                                disabled={busyCollectionId === `${collection.id}:${recipeId}`}
                              >
                                {t("removeFromCollection")}
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : null}

      </section>
    </main>
  );
}
