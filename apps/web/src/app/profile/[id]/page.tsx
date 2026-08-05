"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Avatar } from "../../../components/Avatar";
import { PageSpinner } from "../../../components/PageSpinner";
import { RecipeTypeBadges } from "../../../components/RecipeTypeBadges";
import { StarRating } from "../../../components/StarRating";
import {
  getSavedRecipes,
  getUserProfile,
  getUserRecipes,
  toggleFollowUser,
  toggleSaveRecipe,
} from "../../../lib/api";
import { useAuth } from "../../../lib/auth";
import { useTranslation } from "../../../lib/useTranslation";
import { AdminUser, RecipeListItem } from "../../../lib/types";
import styles from "../../page.module.scss";

export default function UserProfilePage() {
  const params = useParams<{ id: string }>();
  const { user, token, isLoggedIn, showApiError, showSuccess } = useAuth();
  const { t } = useTranslation();
  const [profile, setProfile] = useState<AdminUser | null>(null);
  const [recipes, setRecipes] = useState<RecipeListItem[]>([]);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [followBusy, setFollowBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([getUserProfile(params.id, token), getUserRecipes(params.id)])
      .then(([userData, recipeData]) => {
        setProfile(userData);
        setRecipes(recipeData);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : t("cannotLoadProfile"));
        showApiError(err, t("cannotLoadProfile"));
      })
      .finally(() => setLoading(false));
  }, [params.id, showApiError, t, token]);

  useEffect(() => {
    if (!token || !isLoggedIn) {
      setSavedIds([]);
      return;
    }

    getSavedRecipes(token)
      .then((saved) => setSavedIds(saved.map((recipe) => recipe.id)))
      .catch(() => setSavedIds([]));
  }, [isLoggedIn, token]);

  const isOwnProfile = useMemo(() => user?.id === params.id, [params.id, user?.id]);

  async function handleSave(recipeId: string) {
    if (!token) return;

    setSavingId(recipeId);

    try {
      const result = await toggleSaveRecipe(recipeId, token);
      setSavedIds((prev) => {
        const hasRecipe = prev.includes(recipeId);
        if (result.saved && !hasRecipe) return [...prev, recipeId];
        if (!result.saved && hasRecipe) return prev.filter((id) => id !== recipeId);
        return prev;
      });
      showSuccess(t(result.saved ? "recipeSavedToCollection" : "recipeRemovedFromCollection"));
    } catch (err) {
      showApiError(err, t("saveFailed"));
    } finally {
      setSavingId(null);
    }
  }

  async function handleFollow() {
    if (!token || !profile) return;

    setFollowBusy(true);
    try {
      const response = await toggleFollowUser(profile.id, token);
      setProfile(response.user);
      showSuccess(t(response.following ? "followedAuthorSuccess" : "unfollowedAuthorSuccess"));
    } catch (err) {
      showApiError(err, t("followToggleFailed"));
    } finally {
      setFollowBusy(false);
    }
  }

  if (loading) {
    return (
      <main className={styles.page}>
        <PageSpinner label={t("loadingProfile")} />
      </main>
    );
  }

  return (
    <main className={styles.page}>
      {error ? <p className={styles.error}>{error}</p> : null}
      {profile ? (
        <header className={styles.pageHeader}>
          <div className={styles.profileHeroCard}>
            <Avatar
              name={profile.username}
              avatarUrl={profile.avatarUrl}
              className={styles.profileAvatar}
            />
            <div>
              <h1>@{profile.username}</h1>
              <p>
                {profile.firstName} {profile.lastName}
              </p>
              <p className={styles.smallMuted}>
                {profile.recipeCount} {t("recipeCount")} · {profile.followersCount ?? 0} {t("followers")}
              </p>
            </div>
          </div>
          {isLoggedIn && !isOwnProfile && profile.isRecommended ? (
            <div className={styles.actions}>
              <button className={styles.button} type="button" onClick={handleFollow} disabled={followBusy}>
                {followBusy
                  ? t("saving")
                  : profile.isFollowing
                    ? t("unfollowAuthor")
                    : t("followAuthor")}
              </button>
            </div>
          ) : null}
        </header>
      ) : null}

      <section className={styles.grid}>
        {recipes.map((recipe) => (
          <article key={recipe.id} className={`${styles.card} ${styles.recipeCard}`}>
            <Link href={`/recipes/${recipe.id}`}>
              <h2>{recipe.title}</h2>
              <p>{recipe.shortDescription}</p>
              <RecipeTypeBadges types={recipe.types} maxVisible={3} />
              {recipe.postedByRecommendedUser ? (
                <p className={styles.recommendedLabel}>{t("recommendedAuthor")}</p>
              ) : null}
              <div className={styles.meta}>
                <span>{recipe.preparationTime}</span>
                <span>{recipe.servings}</span>
              </div>
              <div className={styles.cardRating}>
                <StarRating averageRating={recipe.averageRating} ratingsCount={recipe.ratingsCount} />
              </div>
            </Link>
            {isLoggedIn ? (
              <div className={styles.cardFooter}>
                <button
                  type="button"
                  className={`${styles.saveBtn} ${savedIds.includes(recipe.id) ? styles.saveBtnActive : ""}`}
                  disabled={savingId === recipe.id}
                  onClick={() => handleSave(recipe.id)}
                >
                  {savingId === recipe.id ? "..." : savedIds.includes(recipe.id) ? t("saved") : t("save")}
                </button>
              </div>
            ) : null}
          </article>
        ))}
      </section>
    </main>
  );
}
