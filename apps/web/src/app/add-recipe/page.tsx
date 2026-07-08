"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChangeEvent, FormEvent, useState } from "react";
import { SuccessDialog } from "../../components/SuccessDialog";
import { createRecipe } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { useTranslation } from "../../lib/useTranslation";
import styles from "../page.module.scss";

type MediaItem = { type: 'image' | 'video' | 'pdf'; url: string };
type LinkItem = { label: string; url: string };

export default function AddRecipePage() {
  const router = useRouter();
  const { token, isLoggedIn } = useAuth();
  const { t } = useTranslation();
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
      setError(t("mustBeLogged"));
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
        createError instanceof Error ? createError.message : t("recipeNotSaved"),
      );
    }
  }

  function addMedia() {
    if (!mediaUrl.trim()) {
      setError(t("enterMediaUrl"));
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
                reject(new Error(t("unsupportedFileFormat", { fileName: file.name })));
                return;
              }

              const reader = new FileReader();
              reader.onload = () => {
                if (typeof reader.result !== "string") {
                  reject(new Error(t("cannotLoadFile", { fileName: file.name })));
                  return;
                }

                resolve({ type: media, url: reader.result });
              };
              reader.onerror = () => reject(new Error(t("errorReadingFile", { fileName: file.name })));
              reader.readAsDataURL(file);
            }),
        ),
      );

      setMediaItems((prev) => [...prev, ...items]);
      setError("");
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : t("uploadFailed"));
    } finally {
      event.target.value = "";
    }
  }

  function removeMedia(index: number) {
    setMediaItems(mediaItems.filter((_, i) => i !== index));
  }

  function addLink() {
    if (!linkLabel.trim() || !linkUrl.trim()) {
      setError(t("enterLinkDetails"));
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
          <h1>{t("needLoginToAdd")}</h1>
          <p className={styles.muted}>{t("loginAndAdd")}</p>
          <div className={styles.actions}>
            <Link href="/login">{t("login")}</Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <>
      {showSuccess ? (
        <SuccessDialog
          title={t("recipeSaved")}
          description={t("recipeAddedSuccess")}
          actionLabel={t("viewRecipe")}
          onAction={() => router.push("/recipes")}
        />
      ) : null}

      <main className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <h1>{t("addRecipeTitle")}</h1>
          <p>{t("addRecipeDescription")}</p>
        </div>
      </header>

      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.field}>
          <label htmlFor="title">{t("recipeNameLabel")}</label>
          <input id="title" name="title" required />
        </div>
        <div className={styles.field}>
          <label htmlFor="shortDescription">{t("shortDescriptionLabel")}</label>
          <input id="shortDescription" name="shortDescription" required />
        </div>
        <div className={styles.field}>
          <label htmlFor="description">{t("detailedDescriptionLabel")}</label>
          <textarea id="description" name="description" required />
        </div>
        <div className={styles.field}>
          <label htmlFor="ingredients">{t("ingredientsLabel")}</label>
          <textarea id="ingredients" name="ingredients" required />
        </div>
        <div className={styles.field}>
          <label htmlFor="steps">{t("stepsLabel")}</label>
          <textarea id="steps" name="steps" required />
        </div>
        <div className={styles.field}>
          <label htmlFor="preparationTime">{t("preparationTimeLabel")}</label>
          <input id="preparationTime" name="preparationTime" placeholder={t("preparationTimePlaceholder")} required />
        </div>
        <div className={styles.field}>
          <label htmlFor="servings">{t("servingsLabel")}</label>
          <input id="servings" name="servings" placeholder={t("servingsPlaceholder")} required />
        </div>

        <div className={styles.section}>
          <h3>{t("mediaSection")}</h3>
          <p className={styles.hint}>{t("mediaHint")}</p>
          <div className={styles.field}>
            <label htmlFor="mediaFiles">{t("uploadFilesLabel")}</label>
            <input
              id="mediaFiles"
              type="file"
              accept="image/*,video/*,application/pdf"
              multiple
              onChange={handleLocalMediaUpload}
            />
          </div>
          <div className={styles.field}>
            <label>{t("mediaTypeLabel")}</label>
            <select value={mediaType} onChange={(e) => setMediaType(e.target.value as 'image' | 'video' | 'pdf')}>
              <option value="image">{t("image")}</option>
              <option value="video">{t("video")}</option>
              <option value="pdf">{t("pdf")}</option>
            </select>
          </div>
          <div className={styles.field}>
            <label>{t("mediaUrlLabel")}</label>
            <input
              value={mediaUrl}
              onChange={(e) => setMediaUrl(e.target.value)}
              placeholder={
                mediaType === "image"
                  ? "https://..."
                  : mediaType === "video"
                    ? t("videoUrlPlaceholder")
                    : "https://...pdf"
              }
            />
          </div>
          <button type="button" className={styles.secondaryBtn} onClick={addMedia}>
            {t("addMediaButton")}
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
          <h3>{t("linksSection")}</h3>
          <p className={styles.hint}>{t("linksHint")}</p>
          <div className={styles.field}>
            <label>{t("linkLabelField")}</label>
            <input
              value={linkLabel}
              onChange={(e) => setLinkLabel(e.target.value)}
              placeholder={t("linkLabelPlaceholder")}
            />
          </div>
          <div className={styles.field}>
            <label>{t("linkUrlField")}</label>
            <input
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>
          <button type="button" className={styles.secondaryBtn} onClick={addLink}>
            {t("addLinkButton")}
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
        <button className={styles.button}>{t("saveRecipeButton")}</button>
      </form>
    </main>
    </>
  );
}
