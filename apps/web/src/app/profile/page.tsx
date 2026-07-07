"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { PageSpinner } from "../../components/PageSpinner";
import { deleteRecipe, getMyRecipes } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { RecipeListItem } from "../../lib/types";
import styles from "../page.module.scss";

export default function ProfilePage() {
  const { user, token, isLoggedIn } = useAuth();
  const [recipes, setRecipes] = useState<RecipeListItem[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    getMyRecipes(token)
      .then(setRecipes)
      .catch(() => {
        setError("Nije moguce ucitati tvoje recepte");
      })
      .finally(() => setLoading(false));
  }, [token]);

  async function handleDelete() {
    if (!deleteId || !token) return;
    setDeleting(true);
    try {
      await deleteRecipe(deleteId, token);
      // Refresh the recipes list from the server
      const updatedRecipes = await getMyRecipes(token);
      setRecipes(updatedRecipes);
      setDeleteId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Brisanje nije uspelo");
      setDeleteId(null);
    } finally {
      setDeleting(false);
    }
  }

  if (!isLoggedIn || !user) {
    return (
      <main className={styles.page}>
        <section className={styles.card}>
          <h1>Profil je dostupan nakon prijave</h1>
          <div className={styles.actions}>
            <Link href="/login">Prijava</Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <>
      {deleteId ? (
        <ConfirmDialog
          title="Obrisi recept"
          description="Da li si siguran da zelis da obrises ovaj recept? Ova akcija se ne moze ponistiti."
          confirmLabel="Obrisi recept"
          loading={deleting}
          onConfirm={handleDelete}
          onCancel={() => setDeleteId(null)}
        />
      ) : null}

      <main className={styles.page}>
        <header className={styles.pageHeader}>
          <div>
            <h1>Profil</h1>
            <p>
              {user.firstName} {user.lastName} - {user.email}
            </p>
          </div>
        </header>

        <section className={styles.card}>
          <h2>Moji recepti</h2>
          {error ? <p className={styles.error}>{error}</p> : null}
          {loading && !error ? <PageSpinner label="Ucitavanje tvojih recepata..." /> : null}
          {!loading ? (
            recipes.length === 0 ? (
              <p className={styles.muted}>Jos nisi dodao nijedan recept.</p>
            ) : (
            <div className={styles.grid}>
              {recipes.map((recipe) => (
                <div key={recipe.id} className={styles.cardWrapper}>
                  <Link
                    className={`${styles.card} ${styles.recipeCard}`}
                    href={`/recipes/${recipe.id}`}
                  >
                    <h3>{recipe.title}</h3>
                    <p>{recipe.shortDescription}</p>
                    <div className={styles.cardFooter}>
                      <span className={styles.authorLink}>
                        <span className={styles.avatar}>
                          {`${recipe.author.firstName}`.slice(0, 1).toUpperCase()}
                        </span>
                        <span>{recipe.author.firstName} {recipe.author.lastName}</span>
                      </span>
                    </div>
                  </Link>
                  <button
                    className={styles.deleteBtn}
                    type="button"
                    title="Obrisi recept"
                    onClick={() => setDeleteId(recipe.id)}
                  >
                    🗑
                  </button>
                </div>
              ))}
            </div>
            )
          ) : null}
        </section>
      </main>
    </>
  );
}
