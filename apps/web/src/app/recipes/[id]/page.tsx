"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { ConfirmDialog } from "../../../components/ConfirmDialog";
import { PageSpinner } from "../../../components/PageSpinner";
import { StarRating } from "../../../components/StarRating";
import {
  addRecipeComment,
  deleteRecipe,
  getRecipe,
  getSavedRecipes,
  rateRecipe,
  toggleSaveRecipe,
} from "../../../lib/api";
import { useAuth } from "../../../lib/auth";
import { useTranslation } from "../../../lib/useTranslation";
import { RecipeDetails } from "../../../lib/types";
import pageStyles from "../../page.module.scss";
import styles from "./page.module.scss";

function toEmbedUrl(url: string) {
  if (url.includes("youtube.com/watch?v=")) {
    return url.replace("watch?v=", "embed/");
  }

  if (url.includes("youtu.be/")) {
    return url.replace("youtu.be/", "youtube.com/embed/");
  }

  return url;
}

function isYoutubeUrl(url: string) {
  return url.includes("youtube.com/") || url.includes("youtu.be/");
}

function isPdfUrl(url: string) {
  return url.startsWith("data:application/pdf") || url.toLowerCase().includes(".pdf");
}

function formatCommentDate(value: string, locale: "en" | "sr") {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat(locale === "sr" ? "sr-RS" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default function RecipeDetailsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user, token, isLoggedIn } = useAuth();
  const { t, language } = useTranslation();
  const [recipe, setRecipe] = useState<RecipeDetails | null>(null);
  const [error, setError] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [ratingLoading, setRatingLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [commentLoading, setCommentLoading] = useState(false);

  useEffect(() => {
    if (!isLoggedIn || !token) {
      return;
    }

    getRecipe(params.id, token)
      .then(setRecipe)
      .catch((detailsError) =>
        setError(
          detailsError instanceof Error
            ? detailsError.message
            : t("cannotLoadRecipe"),
        ),
      );
  }, [isLoggedIn, params.id, token, t]);

  useEffect(() => {
    if (!token || !isLoggedIn) {
      setIsSaved(false);
      return;
    }

    getSavedRecipes(token)
      .then((savedRecipes) => setIsSaved(savedRecipes.some((entry) => entry.id === params.id)))
      .catch(() => setIsSaved(false));
  }, [isLoggedIn, params.id, token]);

  async function handleDelete() {
    if (!token) return;
    setDeleting(true);
    try {
      await deleteRecipe(params.id, token);
      router.push("/recipes");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("deleteError"));
      setShowConfirm(false);
    } finally {
      setDeleting(false);
    }
  }

  async function handleRate(value: number) {
    if (!token) {
      return;
    }

    setRatingLoading(true);
    setError("");

    try {
      const updatedRecipe = await rateRecipe(params.id, value, token);
      setRecipe(updatedRecipe);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("ratingError"));
    } finally {
      setRatingLoading(false);
    }
  }

  async function handleSaveToggle() {
    if (!token) {
      return;
    }

    setSaving(true);

    try {
      const result = await toggleSaveRecipe(params.id, token);
      setIsSaved(result.saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function handleCommentSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token || !commentText.trim()) {
      return;
    }

    setCommentLoading(true);
    setError("");

    try {
      const updatedRecipe = await addRecipeComment(params.id, commentText, token);
      setRecipe(updatedRecipe);
      setCommentText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("commentError"));
    } finally {
      setCommentLoading(false);
    }
  }

  if (!isLoggedIn) {
    return (
      <main className={pageStyles.page}>
        <section className={pageStyles.card}>
          <h1>{t('recipeDetailsNotAvailable')}</h1>
          <p className={pageStyles.muted}>
            {t('loginToSeeDetails')}
          </p>
          <div className={pageStyles.actions}>
            <Link href="/login">{t('login')}</Link>
          </div>
        </section>
      </main>
    );
  }

  const canDelete =
    recipe && user && (user.isAdmin || recipe.createdBy === user.id);
  const canRate = recipe && user && recipe.createdBy !== user.id;

  return (
    <>
      {showConfirm ? (
        <ConfirmDialog
          title={t('deleteRecipeTitle')}
          description={t('deleteRecipeConfirm', { title: recipe?.title || '' })}
          confirmLabel={t('deleteRecipeButton')}
          loading={deleting}
          onConfirm={handleDelete}
          onCancel={() => setShowConfirm(false)}
        />
      ) : null}

      <main className={`${pageStyles.page} ${styles.pageShell}`}>
        {error ? <p className={pageStyles.error}>{error}</p> : null}
        {!recipe && !error ? (
          <PageSpinner label={t('loadingRecipeDetails')} />
        ) : null}
        {recipe ? (
          <article className={styles.recipeCard}>
            <header className={styles.hero}>
              <div className={styles.tagRow}>
                <span className={styles.tag}>{t('detailedRecipe')}</span>
                {recipe.postedByRecommendedUser ? (
                  <span className={styles.recommendedTag}>{t('recommendedAuthor')}</span>
                ) : null}
              </div>
              <div className={styles.titleRow}>
                <h1 className={styles.title}>{recipe.title}</h1>
                {canDelete ? (
                  <div className={styles.actions}>
                    <button className={styles.saveBtn} type="button" onClick={handleSaveToggle}>
                      {saving ? "..." : isSaved ? t('saved') : t('save')}
                    </button>
                    <Link href={`/edit-recipe/${params.id}`} className={styles.editBtn}>
                      {t('edit')}
                    </Link>
                    <button
                      className={styles.deleteBtn}
                      type="button"
                      onClick={() => setShowConfirm(true)}
                    >
                      {t('deleteRecipeButton')}
                    </button>
                  </div>
                ) : null}
                {!canDelete ? (
                  <div className={styles.actions}>
                    <button className={styles.saveBtn} type="button" onClick={handleSaveToggle}>
                      {saving ? "..." : isSaved ? t('saved') : t('save')}
                    </button>
                  </div>
                ) : null}
              </div>
              <p className={styles.lead}>{recipe.description}</p>
              <div className={styles.metaGrid}>
                <article className={styles.metaCard}>
                  <p className={styles.metaLabel}>{t('preparationTimeLabel')}</p>
                  <p className={styles.metaValue}>{recipe.preparationTime}</p>
                </article>
                <article className={styles.metaCard}>
                  <p className={styles.metaLabel}>{t('servingsLabel')}</p>
                  <p className={styles.metaValue}>{recipe.servings}</p>
                </article>
                <article className={styles.metaCard}>
                  <p className={styles.metaLabel}>{t("category")}</p>
                  <p className={styles.metaValue}>{t("homeTitle")}</p>
                </article>
              </div>
              <div className={styles.ratingBlock}>
                <StarRating
                  averageRating={recipe.averageRating}
                  ratingsCount={recipe.ratingsCount}
                  currentUserRating={recipe.currentUserRating}
                  interactive={Boolean(canRate)}
                  disabled={ratingLoading}
                  onRate={handleRate}
                  helperText={
                    canRate
                      ? ratingLoading
                        ? t('savingRating')
                        : recipe.currentUserRating
                          ? t('yourRating', { rating: recipe.currentUserRating })
                          : t('ratingHelper')
                      : t('authorCannotRate')
                  }
                />
              </div>
            </header>

            <div className={styles.content}>
              {recipe.media && recipe.media.some(item => item.type === "image") ? (
                <section className={styles.section}>
                  <h2 className={styles.sectionTitle}>{t('photos')}</h2>
                  <div className={styles.mediaGrid}>
                    {recipe.media.filter(item => item.type === "image").map((item, idx) => (
                      <div key={`${item.url}-${idx}`} className={styles.mediaItem}>
                        <img
                          src={item.url}
                          alt={t("recipePhotoAlt", { index: idx + 1 })}
                          className={styles.mediaImage}
                        />
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}

              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>{t('ingredients')}</h2>
                <ul className={styles.ingredients}>
                  {recipe.ingredients.map((ingredient, idx) => (
                    <li key={`${ingredient}-${idx}`}>
                      <span className={styles.bullet}>✓</span>
                      <span>{ingredient}</span>
                    </li>
                  ))}
                </ul>
              </section>

              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>{t('preparationSteps')}</h2>
                <ol className={styles.steps}>
                  {recipe.steps.map((step, idx) => (
                    <li key={`${step}-${idx}`}>
                      <span className={styles.stepNumber}>{idx + 1}</span>
                      <span className={styles.stepText}>{step}</span>
                    </li>
                  ))}
                </ol>
              </section>

              {recipe.media && (recipe.media.some(item => item.type === "video") || recipe.media.some(item => isPdfUrl(item.url)) || recipe.media.some(item => isYoutubeUrl(item.url))) ? (
                <section className={styles.section}>
                  <h2 className={styles.sectionTitle}>{t('videosAndContent')}</h2>
                  <div className={styles.mediaGrid}>
                    {recipe.media.filter(item => item.type !== "image").map((item, idx) => (
                      <div key={`${item.url}-${idx}`} className={styles.mediaItem}>
                        {item.type === "pdf" || isPdfUrl(item.url) ? (
                          <div className={styles.pdfWrap}>
                            <iframe src={item.url} title={t("pdfDocumentTitle", { index: idx + 1 })} className={styles.pdfFrame} />
                            <a href={item.url} target="_blank" rel="noopener noreferrer" className={styles.pdfLink}>
                              {t('openPdfNewTab')}
                            </a>
                          </div>
                        ) : isYoutubeUrl(item.url) ? (
                          <div className={styles.videoWrap}>
                            <iframe
                              src={toEmbedUrl(item.url)}
                              title={t("recipeVideoTitle", { index: idx + 1 })}
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                              allowFullScreen
                            />
                          </div>
                        ) : (
                          <video
                            className={styles.videoPlayer}
                            controls
                            playsInline
                            preload="metadata"
                            src={item.url}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}


              {recipe.links && recipe.links.length > 0 ? (
                <section className={styles.section}>
                  <h2 className={styles.sectionTitle}>{t('usefulLinks')}</h2>
                  <ul className={styles.links}>
                    {recipe.links.map((link, idx) => (
                      <li key={`${link.url}-${idx}`}>
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={styles.linkCard}
                        >
                          <span>{link.label}</span>
                          <span>{t('open')}</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              <section className={styles.section}>
                <div className={styles.commentsHeader}>
                  <div>
                    <h2 className={styles.sectionTitle}>{t("comments")}</h2>
                    <p className={styles.commentsHint}>{t("commentsHint")}</p>
                  </div>
                  <span className={styles.commentCount}>
                    {t("commentsCount", { count: recipe.comments.length })}
                  </span>
                </div>

                <form className={styles.commentForm} onSubmit={handleCommentSubmit}>
                  <label htmlFor="comment" className={styles.commentLabel}>
                    {t("addComment")}
                  </label>
                  <textarea
                    id="comment"
                    className={styles.commentInput}
                    value={commentText}
                    maxLength={1000}
                    rows={4}
                    placeholder={t("commentPlaceholder")}
                    onChange={(event) => setCommentText(event.target.value)}
                  />
                  <div className={styles.commentFormFooter}>
                    <span className={styles.commentLimit}>
                      {commentText.length}/1000
                    </span>
                    <button
                      className={styles.commentSubmit}
                      type="submit"
                      disabled={commentLoading || !commentText.trim()}
                    >
                      {commentLoading ? t("saving") : t("publishComment")}
                    </button>
                  </div>
                </form>

                <div className={styles.commentList}>
                  {recipe.comments.length === 0 ? (
                    <p className={styles.noComments}>{t("noComments")}</p>
                  ) : (
                    recipe.comments.map((comment) => {
                      const authorName = `${comment.author.firstName} ${comment.author.lastName}`.trim() || comment.author.username;

                      return (
                        <article
                          key={comment.id}
                          className={`${styles.commentCard} ${comment.isRecipeOwner ? styles.ownerComment : ""}`}
                        >
                          <div className={styles.commentMeta}>
                            <div>
                              <p className={styles.commentAuthor}>{authorName}</p>
                              <p className={styles.commentDate}>
                                {formatCommentDate(comment.createdAt, language)}
                              </p>
                            </div>
                            {comment.isRecipeOwner ? (
                              <span className={styles.ownerBadge}>{t("recipeOwner")}</span>
                            ) : null}
                          </div>
                          <p className={styles.commentText}>{comment.text}</p>
                        </article>
                      );
                    })
                  )}
                </div>
              </section>
            </div>
          </article>
        ) : null}
      </main>
    </>
  );
}
