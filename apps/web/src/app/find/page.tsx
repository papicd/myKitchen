"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { getSavedRecipes, searchRecipes, toggleSaveRecipe } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { RecipeListItem } from "../../lib/types";
import styles from "../page.module.scss";

export default function FindPage() {
  const { token, isLoggedIn } = useAuth();
  const [recipes, setRecipes] = useState<RecipeListItem[]>([]);
  const [error, setError] = useState("");
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!token) {
      setError("Morate biti prijavljeni");
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
          : "Pretraga nije uspela",
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
          <h1>Pretraga je dostupna nakon prijave</h1>
          <p className={styles.muted}>Prijavi se i pronadji recept prema namirnicama.</p>
          <div className={styles.actions}>
            <Link href="/login">Prijava</Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <h1>Pronadji jelo</h1>
          <p>Unesi namirnice odvojene zarezom ili razmakom.</p>
        </div>
      </header>

      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.field}>
          <label htmlFor="groceries">Namirnice</label>
          <input id="groceries" name="groceries" placeholder="piletina pirinac paprika" />
        </div>
        <button className={styles.button}>Pronadji recepte</button>
      </form>

      {error ? <p className={styles.error}>{error}</p> : null}

      <section className={styles.grid}>
        {recipes.map((recipe) => (
          <article className={`${styles.card} ${styles.recipeCard}`} key={recipe.id}>
            <Link href={`/recipes/${recipe.id}`}>
              <h2>{recipe.title}</h2>
              <p>{recipe.shortDescription}</p>
              <div className={styles.meta}>
                <span>Poklapanja: {recipe.matchedGroceries ?? 0}</span>
              </div>
            </Link>
            <div className={styles.cardFooter}>
              <Link href={`/profile/${recipe.author.id}`} className={styles.authorLink}>
                <span className={styles.avatar}>
                  {`${recipe.author.firstName}`.slice(0, 1).toUpperCase()}
                </span>
                <span>{recipe.author.firstName} {recipe.author.lastName}</span>
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
                      ? "Sacuvano"
                      : "Sacuvaj"}
                </button>
              </div>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
