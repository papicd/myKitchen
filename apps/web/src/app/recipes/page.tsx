"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PageSpinner } from "@/components/PageSpinner";
import { RecipeTypeBadges } from "@/components/RecipeTypeBadges";
import { RecipeTypeMultiSelect } from "@/components/RecipeTypeMultiSelect";
import { StarRating } from "@/components/StarRating";
import { getRecipeTypes, getRecipesPage, getSavedRecipes, toggleSaveRecipe } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useTranslation } from "@/lib/useTranslation";
import { RecipeBrowseFilters, RecipeListItem, RecipeSort, RecipeType } from "@/lib/types";
import styles from "../page.module.scss";

const PAGE_SIZE = 12;

export default function RecipesPage() {
  const { token, isLoggedIn } = useAuth();
  const { t } = useTranslation();
  const [recipes, setRecipes] = useState<RecipeListItem[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [groceriesInput, setGroceriesInput] = useState("");
  const [minRatingInput, setMinRatingInput] = useState("");
  const [maxPreparationInput, setMaxPreparationInput] = useState("");
  const [recommendedOnly, setRecommendedOnly] = useState(false);
  const [selectedTypeIds, setSelectedTypeIds] = useState<string[]>([]);
  const [sort, setSort] = useState<RecipeSort>("newest");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [recipeTypes, setRecipeTypes] = useState<RecipeType[]>([]);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const requestIdRef = useRef(0);
  const browseFiltersRef = useRef<RecipeBrowseFilters>({ limit: PAGE_SIZE });

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, 500);

    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  const hasActiveFilters = useMemo(
    () =>
      Boolean(
        debouncedSearch ||
          groceriesInput.trim() ||
          selectedTypeIds.length > 0 ||
          minRatingInput ||
          maxPreparationInput ||
          recommendedOnly,
      ),
    [debouncedSearch, groceriesInput, maxPreparationInput, minRatingInput, recommendedOnly, selectedTypeIds.length],
  );

  const browseFilters = useMemo<RecipeBrowseFilters>(
    () => ({
      query: debouncedSearch || undefined,
      groceries: groceriesInput.trim() || undefined,
      typeIds: selectedTypeIds.length > 0 ? selectedTypeIds : undefined,
      minRating: minRatingInput ? Number.parseFloat(minRatingInput) : undefined,
      maxPreparationMinutes: maxPreparationInput
        ? Number.parseInt(maxPreparationInput, 10)
        : undefined,
      recommendedOnly,
      // When there are no filters, skip custom sort and let backend return newest quickly.
      sort: hasActiveFilters ? sort : undefined,
      limit: PAGE_SIZE,
    }),
    [debouncedSearch, groceriesInput, hasActiveFilters, maxPreparationInput, minRatingInput, recommendedOnly, selectedTypeIds, sort],
  );

  const browseFiltersKey = useMemo(() => JSON.stringify(browseFilters), [browseFilters]);

  useEffect(() => {
    browseFiltersRef.current = browseFilters;
  }, [browseFilters]);

  const loadRecipes = useCallback(async (targetPage: number, replaceItems: boolean) => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    if (replaceItems) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    setError("");

    try {
      const response = await getRecipesPage({ ...browseFiltersRef.current, page: targetPage });

      if (requestId !== requestIdRef.current) {
        return;
      }

      setRecipes((prev) => (replaceItems ? response.items : [...prev, ...response.items]));
      setHasMore(response.hasMore);
      setPage(response.page);
      setTotal(response.total);
    } catch {
      if (requestId !== requestIdRef.current) {
        return;
      }

      setError("recipesUnavailable");
      if (replaceItems) {
        setRecipes([]);
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadRecipes(1, true);
  }, [browseFiltersKey, loadRecipes]);

  useEffect(() => {
    getRecipeTypes()
      .then(setRecipeTypes)
      .catch(() => {
        setRecipeTypes([]);
      });
  }, []);

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

  useEffect(() => {
    if (!hasMore || loading || loadingMore) {
      return;
    }

    const currentSentinel = sentinelRef.current;
    if (!currentSentinel) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry?.isIntersecting && !loadingMore) {
          void loadRecipes(page + 1, false);
        }
      },
      { rootMargin: "220px" },
    );

    observer.observe(currentSentinel);
    return () => observer.disconnect();
  }, [hasMore, loading, loadingMore, loadRecipes, page]);

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

  function resetFilters() {
    setSearchInput("");
    setDebouncedSearch("");
    setGroceriesInput("");
    setSelectedTypeIds([]);
    setMinRatingInput("");
    setMaxPreparationInput("");
    setRecommendedOnly(false);
    setSort("newest");
  }

  return (
    <main className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <h1>{t("recipesTitle")}</h1>
          <p>{t("recipesBasicInfo")}</p>
        </div>
      </header>

      <section className={styles.recipesFilters}>
        <div className={styles.recipesFiltersGrid}>
          <label className={styles.filterField}>
            <span>{t("recipeNameSearchLabel")}</span>
            <input
              type="search"
              value={searchInput}
              placeholder={t("recipeNameSearchPlaceholder")}
              onChange={(event) => setSearchInput(event.target.value)}
            />
          </label>

          <label className={styles.filterField}>
            <span>{t("groceriesFilterLabel")}</span>
            <input
              type="text"
              value={groceriesInput}
              placeholder={t("groceriesFilterPlaceholder")}
              onChange={(event) => setGroceriesInput(event.target.value)}
            />
          </label>

          <div className={styles.filterField}>
            <span>{t("recipeTypesLabel")}</span>
            <RecipeTypeMultiSelect
              options={recipeTypes}
              selectedIds={selectedTypeIds}
              onChangeAction={setSelectedTypeIds}
              placeholder={t("recipeTypePickerPlaceholder")}
              selectedCountLabelAction={(count) => t("recipeTypePickerSelectedCount", { count })}
              selectAllLabel={t("selectAllTypes")}
              clearLabel={t("clearTypes")}
              emptyLabel={t("noRecipeTypesAvailable")}
            />
          </div>

          <label className={styles.filterField}>
            <span>{t("maxPreparationMinutesLabel")}</span>
            <input
              type="number"
              min={1}
              value={maxPreparationInput}
              placeholder="120"
              onChange={(event) => setMaxPreparationInput(event.target.value)}
            />
          </label>

          <label className={styles.filterField}>
            <span>{t("minRatingLabel")}</span>
            <select
              value={minRatingInput}
              onChange={(event) => setMinRatingInput(event.target.value)}
            >
              <option value="">{t("anyRating")}</option>
              <option value="5">5+</option>
              <option value="4">4+</option>
              <option value="3">3+</option>
              <option value="2">2+</option>
              <option value="1">1+</option>
            </select>
          </label>

          <label className={styles.filterField}>
            <span>{t("sortByLabel")}</span>
            <select value={sort} onChange={(event) => setSort(event.target.value as RecipeSort)}>
              <option value="newest">{t("sortNewest")}</option>
              <option value="rating">{t("sortRating")}</option>
              <option value="quickest">{t("sortQuickest")}</option>
            </select>
          </label>

          <label className={styles.checkboxField}>
            <input
              type="checkbox"
              checked={recommendedOnly}
              onChange={(event) => setRecommendedOnly(event.target.checked)}
            />
            <span>{t("recommendedOnly")}</span>
          </label>
        </div>

        <div className={styles.recipesFiltersFooter}>
          <p className={styles.filterResultsText}>
            {t("recipesFound", { count: total })}
          </p>
          <button type="button" className={styles.secondaryBtn} onClick={resetFilters}>
            {t("clearFilters")}
          </button>
        </div>
      </section>

      {error ? <p className={styles.error}>{t(error)}</p> : null}
      {loading && !error ? <PageSpinner label={t("loadingRecipes")} /> : null}

      <section className={styles.grid}>
        {recipes.map((recipe) => (
          <article className={`${styles.card} ${styles.recipeCard}`} key={recipe.id}>
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
                  {`${recipe.author.username}`.slice(0, 1).toUpperCase()}
                </span>
                <span>@{recipe.author.username}</span>
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

      {!loading && recipes.length === 0 && !error ? (
        <p className={styles.muted}>{t("noRecipesForFilters")}</p>
      ) : null}

      <div ref={sentinelRef} className={styles.lazySentinel} aria-hidden="true" />

      {loadingMore ? <PageSpinner label={t("loadingMoreRecipes")} /> : null}

      {!loading && hasMore ? (
        <div className={styles.loadMoreWrap}>
          <button
            type="button"
            className={styles.secondaryBtn}
            disabled={loadingMore}
            onClick={() => void loadRecipes(page + 1, false)}
          >
            {t("loadMoreRecipes")}
          </button>
        </div>
      ) : null}
    </main>
  );
}
