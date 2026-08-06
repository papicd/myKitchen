"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PageSpinner } from "../../components/PageSpinner";
import {
  createRecipeCollection,
  deleteRecipeCollection,
  getRecipeCollections,
  getSavedRecipes,
  removeRecipeFromCollection,
  renameRecipeCollection,
} from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { RecipeCollection, RecipeListItem } from "../../lib/types";
import { useTranslation } from "../../lib/useTranslation";
import styles from "../page.module.scss";

export default function CollectionsPage() {
  const { token, isLoggedIn, showApiError, showSuccess } = useAuth();
  const { t } = useTranslation();
  const [savedRecipes, setSavedRecipes] = useState<RecipeListItem[]>([]);
  const [collections, setCollections] = useState<RecipeCollection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyCollectionId, setBusyCollectionId] = useState<string | null>(null);
  const [collectionName, setCollectionName] = useState("");
  const [renameDrafts, setRenameDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!token || !isLoggedIn) {
      setLoading(false);
      return;
    }

    Promise.all([getSavedRecipes(token), getRecipeCollections(token)])
      .then(([saved, collectionItems]) => {
        setSavedRecipes(saved);
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

  const savedById = useMemo(
    () => new Map(savedRecipes.map((recipe) => [recipe.id, recipe])),
    [savedRecipes],
  );

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

  return (
    <main className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <h1>{t("collectionsTitle")}</h1>
          <p>{t("collectionsDescription")}</p>
        </div>
      </header>

      <section className={styles.card}>
        {error ? <p className={styles.error}>{error}</p> : null}
        {loading ? <PageSpinner label={t("loadingMyRecipes")} /> : null}

        {!loading ? (
          <div className={styles.collectionList}>
            <div className={`${styles.collectionItem} ${styles.collectionCreateCard}`}>
              <div className={styles.field}>
                <label htmlFor="collectionName">{t("newCollectionName")}</label>
                <input
                  id="collectionName"
                  className={styles.collectionInput}
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
                      className={styles.collectionInput}
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
                                <Link className={styles.collectionViewButton} href={`/recipes/${recipe.id}`}>
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
