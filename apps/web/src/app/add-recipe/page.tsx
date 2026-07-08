"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChangeEvent, FormEvent, useState } from "react";
import { SuccessDialog } from "../../components/SuccessDialog";
import { createRecipe } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import styles from "../page.module.scss";

type MediaItem = { type: 'image' | 'video' | 'pdf'; url: string };
type LinkItem = { label: string; url: string };

export default function AddRecipePage() {
  const router = useRouter();
  const { token, isLoggedIn } = useAuth();
  const [error, setError] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);

  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaType, setMediaType] = useState<'image' | 'video' | 'pdf'>('image');

  const [linkItems, setLinkItems] = useState<LinkItem[]>([]);
  const [linkLabel, setLinkLabel] = useState("");
  const [linkUrl, setLinkUrl] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!token) {
      setError("Morate biti prijavljeni");
      return;
    }

    const form = event.currentTarget;
    const formData = new FormData(form);

    try {
      await createRecipe(
        {
          title: String(formData.get("title")),
          shortDescription: String(formData.get("shortDescription")),
          description: String(formData.get("description")),
          ingredients: String(formData.get("ingredients")).split(/[,\n]+/),
          steps: String(formData.get("steps")).split(/\n+/),
          preparationTime: String(formData.get("preparationTime")),
          servings: String(formData.get("servings")),
          media: mediaItems.length > 0 ? mediaItems : undefined,
          links: linkItems.length > 0 ? linkItems : undefined,
        },
        token,
      );
      form.reset();
      setMediaItems([]);
      setLinkItems([]);
      setMediaUrl("");
      setLinkLabel("");
      setLinkUrl("");
      setShowSuccess(true);
    } catch (createError) {
      setError(
        createError instanceof Error ? createError.message : "Recept nije sacuvan",
      );
    }
  }

  function addMedia() {
    if (!mediaUrl.trim()) {
      setError("Unesite URL slike, videa ili PDF-a");
      return;
    }
    setMediaItems([...mediaItems, { type: mediaType, url: mediaUrl }]);
    setMediaUrl("");
  }

  function detectMediaType(file: File): MediaItem["type"] | null {
    if (file.type.startsWith("image/")) {
      return "image";
    }

    if (file.type.startsWith("video/")) {
      return "video";
    }

    if (file.type === "application/pdf") {
      return "pdf";
    }

    return null;
  }

  async function handleLocalMediaUpload(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);

    if (files.length === 0) {
      return;
    }

    try {
      const items = await Promise.all(
        files.map(
          (file) =>
            new Promise<MediaItem>((resolve, reject) => {
              const media = detectMediaType(file);

              if (!media) {
                reject(new Error(`Format fajla nije podrzan: ${file.name}`));
                return;
              }

              const reader = new FileReader();
              reader.onload = () => {
                if (typeof reader.result !== "string") {
                  reject(new Error(`Nije moguce ucitati fajl: ${file.name}`));
                  return;
                }

                resolve({ type: media, url: reader.result });
              };
              reader.onerror = () => reject(new Error(`Greska pri citanju fajla: ${file.name}`));
              reader.readAsDataURL(file);
            }),
        ),
      );

      setMediaItems((prev) => [...prev, ...items]);
      setError("");
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Upload fajlova nije uspeo");
    } finally {
      event.target.value = "";
    }
  }

  function removeMedia(index: number) {
    setMediaItems(mediaItems.filter((_, i) => i !== index));
  }

  function addLink() {
    if (!linkLabel.trim() || !linkUrl.trim()) {
      setError("Unesite naslov i URL linka");
      return;
    }
    setLinkItems([...linkItems, { label: linkLabel, url: linkUrl }]);
    setLinkLabel("");
    setLinkUrl("");
  }

  function removeLink(index: number) {
    setLinkItems(linkItems.filter((_, i) => i !== index));
  }

  if (!isLoggedIn) {
    return (
      <main className={styles.page}>
        <section className={styles.card}>
          <h1>Dodavanje recepta trazi prijavu</h1>
          <p className={styles.muted}>Prijavi se i dodaj svoj prvi recept.</p>
          <div className={styles.actions}>
            <Link href="/login">Prijava</Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <>
      {showSuccess ? (
        <SuccessDialog
          title="Recept je sačuvan!"
          description="Tvoj novi recept je uspešno dodat u bazu."
          actionLabel="Pregled"
          onAction={() => router.push("/recipes")}
        />
      ) : null}

      <main className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <h1>Dodaj recept</h1>
          <p>Svi tekstovi i nazivi treba da budu na srpskom jeziku.</p>
        </div>
      </header>

      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.field}>
          <label htmlFor="title">Naziv recepta</label>
          <input id="title" name="title" required />
        </div>
        <div className={styles.field}>
          <label htmlFor="shortDescription">Kratak opis</label>
          <input id="shortDescription" name="shortDescription" required />
        </div>
        <div className={styles.field}>
          <label htmlFor="description">Detaljan opis</label>
          <textarea id="description" name="description" required />
        </div>
        <div className={styles.field}>
          <label htmlFor="ingredients">Sastojci, odvojeni zarezom</label>
          <textarea id="ingredients" name="ingredients" required />
        </div>
        <div className={styles.field}>
          <label htmlFor="steps">Koraci pripreme, svaki u novom redu</label>
          <textarea id="steps" name="steps" required />
        </div>
        <div className={styles.field}>
          <label htmlFor="preparationTime">Vreme pripreme</label>
          <input id="preparationTime" name="preparationTime" placeholder="45 minuta" required />
        </div>
        <div className={styles.field}>
          <label htmlFor="servings">Broj porcija</label>
          <input id="servings" name="servings" placeholder="4 porcije" required />
        </div>

        <div className={styles.section}>
          <h3>Medija (opciono)</h3>
          <p className={styles.hint}>Dodaj lokalne fajlove (slika/video/PDF) ili URL medije.</p>
          <div className={styles.field}>
            <label htmlFor="mediaFiles">Upload fajlova sa racunara</label>
            <input
              id="mediaFiles"
              type="file"
              accept="image/*,video/*,application/pdf"
              multiple
              onChange={handleLocalMediaUpload}
            />
          </div>
          <div className={styles.field}>
            <label>Tip medije</label>
            <select value={mediaType} onChange={(e) => setMediaType(e.target.value as 'image' | 'video' | 'pdf')}>
              <option value="image">Slika</option>
              <option value="video">Video</option>
              <option value="pdf">PDF</option>
            </select>
          </div>
          <div className={styles.field}>
            <label>URL medije</label>
            <input
              value={mediaUrl}
              onChange={(e) => setMediaUrl(e.target.value)}
              placeholder={
                mediaType === "image"
                  ? "https://..."
                  : mediaType === "video"
                    ? "https://... ili mp4 URL"
                    : "https://...pdf"
              }
            />
          </div>
          <button type="button" className={styles.secondaryBtn} onClick={addMedia}>
            + Dodaj mediju
          </button>
          {mediaItems.length > 0 && (
            <div className={styles.itemsList}>
              {mediaItems.map((item, idx) => (
                <div key={idx} className={styles.listItem}>
                  <span>
                    {item.type === 'image' ? '🖼' : item.type === 'video' ? '🎬' : '📄'} {item.url.slice(0, 90)}
                    {item.url.length > 90 ? "..." : ""}
                  </span>
                  <button type="button" className={styles.removeBtn} onClick={() => removeMedia(idx)}>
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={styles.section}>
          <h3>Spoljni linkovi (opciono)</h3>
          <p className={styles.hint}>Dodaj linkove na spoljne resurse kao što su YouTube videi ili drugi recepti.</p>
          <div className={styles.field}>
            <label>Naslov linka</label>
            <input
              value={linkLabel}
              onChange={(e) => setLinkLabel(e.target.value)}
              placeholder="Npr: Videopriprema"
            />
          </div>
          <div className={styles.field}>
            <label>URL linka</label>
            <input
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>
          <button type="button" className={styles.secondaryBtn} onClick={addLink}>
            + Dodaj link
          </button>
          {linkItems.length > 0 && (
            <div className={styles.itemsList}>
              {linkItems.map((item, idx) => (
                <div key={idx} className={styles.listItem}>
                  <span>🔗 {item.label}: {item.url}</span>
                  <button type="button" className={styles.removeBtn} onClick={() => removeLink(idx)}>
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {error ? <p className={styles.error}>{error}</p> : null}
        <button className={styles.button}>Sacuvaj recept</button>
      </form>
    </main>
    </>
  );
}
