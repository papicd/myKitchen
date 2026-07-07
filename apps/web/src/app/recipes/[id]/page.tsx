"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ConfirmDialog } from "../../../components/ConfirmDialog";
import { PageSpinner } from "../../../components/PageSpinner";
import { StarRating } from "../../../components/StarRating";
import {
  deleteRecipe,
  getRecipe,
  getSavedRecipes,
  rateRecipe,
  toggleSaveRecipe,
} from "../../../lib/api";
import { useAuth } from "../../../lib/auth";
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

export default function RecipeDetailsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user, token, isLoggedIn } = useAuth();
  const [recipe, setRecipe] = useState<RecipeDetails | null>(null);
  const [error, setError] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [ratingLoading, setRatingLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

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
            : "Recept nije moguce ucitati",
        ),
      );
  }, [isLoggedIn, params.id, token]);

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
      setError(err instanceof Error ? err.message : "Brisanje nije uspelo");
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
      setError(err instanceof Error ? err.message : "Ocenjivanje nije uspelo");
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
      setError(err instanceof Error ? err.message : "Cuvanje nije uspelo");
    } finally {
      setSaving(false);
    }
  }

  if (!isLoggedIn) {
    return (
      <main className={pageStyles.page}>
        <section className={pageStyles.card}>
          <h1>Detalji recepta su dostupni nakon prijave</h1>
          <p className={pageStyles.muted}>
            Prijavi se da vidis opis, sastojke i korake pripreme.
          </p>
          <div className={pageStyles.actions}>
            <Link href="/login">Prijava</Link>
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
          title="Obrisi recept"
          description={`Da li si siguran da zelis da obrises recept "${recipe?.title}"? Ova akcija se ne moze ponistiti.`}
          confirmLabel="Obrisi recept"
          loading={deleting}
          onConfirm={handleDelete}
          onCancel={() => setShowConfirm(false)}
        />
      ) : null}

      <main className={`${pageStyles.page} ${styles.pageShell}`}>
        {error ? <p className={pageStyles.error}>{error}</p> : null}
        {!recipe && !error ? (
          <PageSpinner label="Ucitavanje recepta..." />
        ) : null}
        {recipe ? (
          <article className={styles.recipeCard}>
            <header className={styles.hero}>
              <div className={styles.tagRow}>
                <span className={styles.tag}>Detaljan recept</span>
                {recipe.postedByRecommendedUser ? (
                  <span className={styles.recommendedTag}>Preporuceni autor</span>
                ) : null}
              </div>
              <div className={styles.titleRow}>
                <h1 className={styles.title}>{recipe.title}</h1>
                {canDelete ? (
                  <div className={styles.actions}>
                    <button className={styles.saveBtn} type="button" onClick={handleSaveToggle}>
                      {saving ? "..." : isSaved ? "Sacuvano" : "Sacuvaj"}
                    </button>
                    <Link href={`/edit-recipe/${params.id}`} className={styles.editBtn}>
                      Izmeni
                    </Link>
                    <button
                      className={styles.deleteBtn}
                      type="button"
                      onClick={() => setShowConfirm(true)}
                    >
                      Obrisi recept
                    </button>
                  </div>
                ) : null}
                {!canDelete ? (
                  <div className={styles.actions}>
                    <button className={styles.saveBtn} type="button" onClick={handleSaveToggle}>
                      {saving ? "..." : isSaved ? "Sacuvano" : "Sacuvaj"}
                    </button>
                  </div>
                ) : null}
              </div>
              <p className={styles.lead}>{recipe.description}</p>
              <div className={styles.metaGrid}>
                <article className={styles.metaCard}>
                  <p className={styles.metaLabel}>Vreme pripreme</p>
                  <p className={styles.metaValue}>{recipe.preparationTime}</p>
                </article>
                <article className={styles.metaCard}>
                  <p className={styles.metaLabel}>Broj porcija</p>
                  <p className={styles.metaValue}>{recipe.servings}</p>
                </article>
                <article className={styles.metaCard}>
                  <p className={styles.metaLabel}>Kategorija</p>
                  <p className={styles.metaValue}>Domaca kuhinja</p>
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
                        ? "Cuvanje ocene..."
                        : recipe.currentUserRating
                          ? `Tvoja ocena: ${recipe.currentUserRating}`
                          : "Klikni na zvezdicu da ocenite recept"
                      : "Autor recepta ne moze oceniti sopstveno jelo"
                  }
                />
              </div>
            </header>

            <div className={styles.content}>
              {recipe.media && recipe.media.length > 0 ? (
                <section className={styles.section}>
                  <h2 className={styles.sectionTitle}>Foto i video</h2>
                  <div className={styles.mediaGrid}>
                    {recipe.media.map((item, idx) => (
                      <div key={`${item.url}-${idx}`} className={styles.mediaItem}>
                        {item.type === "image" ? (
                          <img
                            src={item.url}
                            alt={`Fotografija recepta ${idx + 1}`}
                            className={styles.mediaImage}
                          />
                        ) : (
                          <div className={styles.videoWrap}>
                            <iframe
                              src={toEmbedUrl(item.url)}
                              title={`Video recepta ${idx + 1}`}
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                              allowFullScreen
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}

              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>Sastojci</h2>
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
                <h2 className={styles.sectionTitle}>Koraci pripreme</h2>
                <ol className={styles.steps}>
                  {recipe.steps.map((step, idx) => (
                    <li key={`${step}-${idx}`}>
                      <span className={styles.stepNumber}>{idx + 1}</span>
                      <span className={styles.stepText}>{step}</span>
                    </li>
                  ))}
                </ol>
              </section>

              {recipe.links && recipe.links.length > 0 ? (
                <section className={styles.section}>
                  <h2 className={styles.sectionTitle}>Korisni linkovi</h2>
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
                          <span>Otvori</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </div>
          </article>
        ) : null}
      </main>
    </>
  );
}
