"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { RecipeTypeMultiSelect } from "../../components/RecipeTypeMultiSelect";
import { SuccessDialog } from "../../components/SuccessDialog";
import { createRecipe, createRecipeType, getRecipeTypes } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { RecipeType } from "../../lib/types";
import { useTranslation } from "../../lib/useTranslation";
import styles from "./page.module.scss";

type MediaItem = { type: "image" | "video" | "pdf"; url: string };
type LinkItem = { label: string; url: string };

const INGREDIENTS_SEPARATOR = /[,\n]+/;
const STEPS_SEPARATOR = /\n+/;

function normalizeText(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

function parseList(value: FormDataEntryValue | null, separator: RegExp) {
  return normalizeText(value)
    .split(separator)
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function AddRecipePage() {
  const router = useRouter();
  const { user, token, isLoggedIn, showApiError, showSuccess } = useAuth();
  const { t } = useTranslation();
  const [error, setError] = useState("");
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaType, setMediaType] = useState<"image" | "video" | "pdf">("image");

  const [linkItems, setLinkItems] = useState<LinkItem[]>([]);
  const [linkLabel, setLinkLabel] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [recipeTypes, setRecipeTypes] = useState<RecipeType[]>([]);
  const [selectedTypeIds, setSelectedTypeIds] = useState<string[]>([]);
  const [newTypeName, setNewTypeName] = useState("");
  const [newTypeColor, setNewTypeColor] = useState("#22C55E");

  useEffect(() => {
    let isMounted = true;

    getRecipeTypes()
      .then((types) => {
        if (isMounted) {
          setRecipeTypes(types);
        }
      })
      .catch((loadError) => {
        if (isMounted) {
          setError(loadError instanceof Error ? loadError.message : t("cannotLoadRecipeTypes"));
          showApiError(loadError, t("cannotLoadRecipeTypes"));
        }
      });

    return () => {
      isMounted = false;
    };
  }, [showApiError, t]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!token) {
      setError(t("mustBeLogged"));
      return;
    }

    const form = event.currentTarget;
    const formData = new FormData(form);
    const title = normalizeText(formData.get("title"));
    const shortDescription = normalizeText(formData.get("shortDescription"));
    const description = normalizeText(formData.get("description"));
    const ingredients = parseList(formData.get("ingredients"), INGREDIENTS_SEPARATOR);
    const steps = parseList(formData.get("steps"), STEPS_SEPARATOR);
    const preparationTime = normalizeText(formData.get("preparationTime"));
    const servings = normalizeText(formData.get("servings"));

    if (!title || !shortDescription) {
      setError(t("completeRequiredFields"));
      return;
    }

    if (ingredients.length === 0) {
      setError(t("addAtLeastOneIngredient"));
      return;
    }

    if (steps.length === 0) {
      setError(t("addAtLeastOneStep"));
      return;
    }

    if (selectedTypeIds.length === 0) {
      setError(t("pickAtLeastOneType"));
      return;
    }

    setIsSubmitting(true);

    try {
      await createRecipe(
        {
          title,
          shortDescription,
          ...(description ? { description } : {}),
          ingredients,
          steps,
          ...(preparationTime ? { preparationTime } : {}),
          ...(servings ? { servings } : {}),
          typeIds: selectedTypeIds,
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
      setSelectedTypeIds([]);
      showSuccess(t("recipeSaved"));
      setShowSuccessDialog(true);
    } catch (createError) {
      showApiError(createError, t("recipeNotSaved"));
    } finally {
      setIsSubmitting(false);
    }
  }

  function addMedia() {
    const nextUrl = mediaUrl.trim();

    if (!nextUrl) {
      setError(t("enterMediaUrl"));
      return;
    }

    setMediaItems((prev) => [...prev, { type: mediaType, url: nextUrl }]);
    setMediaUrl("");
    setError("");
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
    const nextLabel = linkLabel.trim();
    const nextUrl = linkUrl.trim();

    if (!nextLabel || !nextUrl) {
      setError(t("enterLinkDetails"));
      return;
    }

    setLinkItems((prev) => [...prev, { label: nextLabel, url: nextUrl }]);
    setLinkLabel("");
    setLinkUrl("");
    setError("");
  }

  function removeLink(index: number) {
    setLinkItems(linkItems.filter((_, i) => i !== index));
  }

  async function handleCreateType() {
    if (!token || !user?.isAdmin) {
      return;
    }

    const trimmedTypeName = newTypeName.trim();

    if (!trimmedTypeName) {
      setError(t("enterRecipeTypeName"));
      return;
    }

    try {
      const created = await createRecipeType(
        {
          name: trimmedTypeName,
          color: newTypeColor,
        },
        token,
      );

      setRecipeTypes((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      setSelectedTypeIds((prev) => [...prev, created.id]);
      setNewTypeName("");
      setError("");
      showSuccess(t("recipeTypeCreated"));
    } catch (typeError) {
      showApiError(typeError, t("cannotCreateRecipeType"));
    }
  }

  if (!isLoggedIn) {
    return (
      <main className={styles.page}>
        <section className={styles.loginCard}>
          <h1>{t("needLoginToAdd")}</h1>
          <p>{t("loginAndAdd")}</p>
          <div className={styles.loginActions}>
            <Link href="/login">{t("login")}</Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <>
      {showSuccessDialog ? (
        <SuccessDialog
          title={t("recipeSaved")}
          description={t("recipeAddedSuccess")}
          actionLabel={t("viewRecipe")}
          onAction={() => router.push("/recipes")}
        />
      ) : null}

      <main className={styles.page}>
        <form className={styles.formLayout} onSubmit={handleSubmit}>
          <div className={styles.mainColumn}>
            <section className={styles.sectionCard}>
              <div className={styles.sectionHeader}>
                <div className={styles.sectionHeading}>
                  <span className={styles.sectionEyebrow}>{t("requiredBadge")}</span>
                  <h2 className={styles.sectionTitle}>{t("addRecipeTitle")}</h2>
                </div>
              </div>

              <div className={styles.fieldGrid}>
                <div className={styles.field}>
                  <div className={styles.labelRow}>
                    <label htmlFor="title">{t("recipeNameLabel")}</label>
                    <span className={`${styles.fieldBadge} ${styles.fieldBadgeRequired}`}>{t("requiredBadge")}</span>
                  </div>
                  <input
                    className={styles.input}
                    id="title"
                    name="title"
                    placeholder={t("recipeTitlePlaceholder")}
                    required
                  />
                </div>

                <div className={styles.field}>
                  <div className={styles.labelRow}>
                    <label htmlFor="shortDescription">{t("shortDescriptionLabel")}</label>
                    <span className={`${styles.fieldBadge} ${styles.fieldBadgeRequired}`}>{t("requiredBadge")}</span>
                  </div>
                  <input
                    className={styles.input}
                    id="shortDescription"
                    name="shortDescription"
                    placeholder={t("recipeShortDescriptionPlaceholder")}
                    required
                  />
                </div>

                <div className={styles.fieldFull}>
                  <div className={styles.labelRow}>
                    <label htmlFor="description">{t("detailedDescriptionLabel")}</label>
                    <span className={`${styles.fieldBadge} ${styles.fieldBadgeOptional}`}>{t("optionalBadge")}</span>
                  </div>
                  <textarea
                    className={`${styles.textarea} ${styles.textareaCompact}`}
                    id="description"
                    name="description"
                    placeholder={t("recipeDescriptionPlaceholder")}
                  />
                </div>
              </div>
            </section>

            <section className={styles.sectionCard}>
              <div className={styles.sectionHeader}>
                <div className={styles.sectionHeading}>
                  <span className={styles.sectionEyebrow}>{t("requiredBadge")}</span>
                  <h2 className={styles.sectionTitle}>{t("addRecipeWorkflowTitle")}</h2>
                </div>
              </div>

              <div className={styles.fieldGrid}>
                <div className={styles.fieldFull}>
                  <div className={styles.labelRow}>
                    <label htmlFor="ingredients">{t("ingredientsLabel")}</label>
                    <span className={`${styles.fieldBadge} ${styles.fieldBadgeRequired}`}>{t("requiredBadge")}</span>
                  </div>
                  <textarea
                    className={styles.textarea}
                    id="ingredients"
                    name="ingredients"
                    placeholder={t("ingredientsPlaceholder")}
                    required
                  />
                </div>

                <div className={styles.fieldFull}>
                  <div className={styles.labelRow}>
                    <label htmlFor="steps">{t("stepsLabel")}</label>
                    <span className={`${styles.fieldBadge} ${styles.fieldBadgeRequired}`}>{t("requiredBadge")}</span>
                  </div>
                  <textarea
                    className={styles.textarea}
                    id="steps"
                    name="steps"
                    placeholder={t("stepsPlaceholder")}
                    required
                  />
                </div>
              </div>
            </section>

            <section className={styles.sectionCard}>
              <div className={styles.sectionHeader}>
                <div className={styles.sectionHeading}>
                  <span className={styles.sectionEyebrow}>{t("optionalBadge")}</span>
                  <h2 className={styles.sectionTitle}>{t("addRecipeOptionalDetailsTitle")}</h2>
                </div>
              </div>

              <div className={styles.fieldGrid}>
                <div className={styles.field}>
                  <div className={styles.labelRow}>
                    <label htmlFor="preparationTime">{t("preparationTimeLabel")}</label>
                    <span className={`${styles.fieldBadge} ${styles.fieldBadgeOptional}`}>{t("optionalBadge")}</span>
                  </div>
                  <input
                    className={styles.input}
                    id="preparationTime"
                    name="preparationTime"
                    placeholder={t("preparationTimePlaceholder")}
                  />
                </div>

                <div className={styles.field}>
                  <div className={styles.labelRow}>
                    <label htmlFor="servings">{t("servingsLabel")}</label>
                    <span className={`${styles.fieldBadge} ${styles.fieldBadgeOptional}`}>{t("optionalBadge")}</span>
                  </div>
                  <input
                    className={styles.input}
                    id="servings"
                    name="servings"
                    placeholder={t("servingsPlaceholder")}
                  />
                </div>
              </div>
            </section>
          </div>

          <div className={styles.sideColumn}>
            <section className={styles.sectionCard}>
              <div className={styles.sectionHeader}>
                <div className={styles.sectionHeading}>
                  <span className={styles.sectionEyebrow}>{t("requiredBadge")}</span>
                  <h2 className={styles.sectionTitle}>{t("recipeTypesLabel")}</h2>
                  <p className={styles.sectionText}>{t("recipeTypeSectionDescription")}</p>
                </div>
              </div>

              <div className={styles.field}>
                <RecipeTypeMultiSelect
                  id="typeIds"
                  options={recipeTypes}
                  selectedIds={selectedTypeIds}
                  onChangeAction={setSelectedTypeIds}
                  placeholder={t("recipeTypePickerPlaceholder")}
                  selectedCountLabelAction={(count) => t("recipeTypePickerSelectedCount", { count })}
                  selectAllLabel={t("selectAllTypes")}
                  clearLabel={t("clearTypes")}
                  emptyLabel={t("noRecipeTypesAvailable")}
                />
                <p className={styles.helper}>{t("recipeTypesHint")}</p>
              </div>
            </section>

            {user?.isAdmin ? (
              <section className={styles.sectionCard}>
                <div className={styles.sectionHeader}>
                  <div className={styles.sectionHeading}>
                    <span className={styles.sectionEyebrow}>{t("optionalBadge")}</span>
                    <h2 className={styles.sectionTitle}>{t("addRecipeTypeTitle")}</h2>
                    <p className={styles.sectionText}>{t("recipeTypesAdminDescription")}</p>
                  </div>
                </div>

                <div className={styles.fieldGrid}>
                  <div className={styles.fieldFull}>
                    <label className={styles.simpleLabel} htmlFor="newTypeName">{t("recipeTypeNameLabel")}</label>
                    <input
                      className={styles.input}
                      id="newTypeName"
                      value={newTypeName}
                      onChange={(event) => setNewTypeName(event.target.value)}
                      placeholder={t("recipeTypeNamePlaceholder")}
                    />
                  </div>
                  <div className={styles.fieldFull}>
                    <label className={styles.simpleLabel} htmlFor="newTypeColor">{t("recipeTypeColorLabel")}</label>
                    <input
                      className={styles.colorField}
                      id="newTypeColor"
                      type="color"
                      value={newTypeColor}
                      onChange={(event) => setNewTypeColor(event.target.value.toUpperCase())}
                    />
                  </div>
                </div>

                <div className={styles.buttonRow}>
                  <button type="button" className={styles.secondaryButton} onClick={() => void handleCreateType()}>
                    {t("addRecipeTypeButton")}
                  </button>
                </div>
              </section>
            ) : null}

            <section className={styles.sectionCard}>
              <div className={styles.sectionHeader}>
                <div className={styles.sectionHeading}>
                  <span className={styles.sectionEyebrow}>{t("optionalBadge")}</span>
                  <h2 className={styles.sectionTitle}>{t("mediaSection")}</h2>
                  <p className={styles.sectionText}>{t("mediaHint")}</p>
                </div>
              </div>

              <div className={styles.fieldGrid}>
                <div className={styles.fieldFull}>
                  <label className={styles.simpleLabel} htmlFor="mediaFiles">{t("uploadFilesLabel")}</label>
                  <input
                    className={styles.fileInput}
                    id="mediaFiles"
                    type="file"
                    accept="image/*,video/*,application/pdf"
                    multiple
                    onChange={handleLocalMediaUpload}
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.simpleLabel} htmlFor="mediaType">{t("mediaTypeLabel")}</label>
                  <select
                    className={styles.select}
                    id="mediaType"
                    value={mediaType}
                    onChange={(event) => setMediaType(event.target.value as MediaItem["type"])}
                  >
                    <option value="image">{t("image")}</option>
                    <option value="video">{t("video")}</option>
                    <option value="pdf">{t("pdf")}</option>
                  </select>
                </div>
                <div className={styles.field}>
                  <label className={styles.simpleLabel} htmlFor="mediaUrl">{t("mediaUrlLabel")}</label>
                  <input
                    className={styles.input}
                    id="mediaUrl"
                    value={mediaUrl}
                    onChange={(event) => setMediaUrl(event.target.value)}
                    placeholder={
                      mediaType === "image"
                        ? "https://..."
                        : mediaType === "video"
                          ? t("videoUrlPlaceholder")
                          : "https://...pdf"
                    }
                  />
                </div>
              </div>

              <div className={styles.buttonRow}>
                <button type="button" className={styles.secondaryButton} onClick={addMedia}>
                  {t("addMediaButton")}
                </button>
              </div>

              {mediaItems.length > 0 ? (
                <div className={styles.itemsList}>
                  {mediaItems.map((item, idx) => (
                    <div key={`${item.url}-${idx}`} className={styles.listItem}>
                      <div className={styles.itemContent}>
                        <span className={styles.itemTitle}>
                          {item.type === "image" ? "🖼" : item.type === "video" ? "🎬" : "📄"} {t(item.type)}
                        </span>
                        <span className={styles.itemSubtitle}>
                          {item.url.length > 110 ? `${item.url.slice(0, 110)}...` : item.url}
                        </span>
                      </div>
                      <button type="button" className={styles.removeButton} onClick={() => removeMedia(idx)}>
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
            </section>

            <section className={styles.sectionCard}>
              <div className={styles.sectionHeader}>
                <div className={styles.sectionHeading}>
                  <span className={styles.sectionEyebrow}>{t("optionalBadge")}</span>
                  <h2 className={styles.sectionTitle}>{t("linksSection")}</h2>
                  <p className={styles.sectionText}>{t("linksHint")}</p>
                </div>
              </div>

              <div className={styles.fieldGrid}>
                <div className={styles.fieldFull}>
                  <label className={styles.simpleLabel} htmlFor="linkLabel">{t("linkLabelField")}</label>
                  <input
                    className={styles.input}
                    id="linkLabel"
                    value={linkLabel}
                    onChange={(event) => setLinkLabel(event.target.value)}
                    placeholder={t("linkLabelPlaceholder")}
                  />
                </div>
                <div className={styles.fieldFull}>
                  <label className={styles.simpleLabel} htmlFor="linkUrl">{t("linkUrlField")}</label>
                  <input
                    className={styles.input}
                    id="linkUrl"
                    value={linkUrl}
                    onChange={(event) => setLinkUrl(event.target.value)}
                    placeholder="https://..."
                  />
                </div>
              </div>

              <div className={styles.buttonRow}>
                <button type="button" className={styles.secondaryButton} onClick={addLink}>
                  {t("addLinkButton")}
                </button>
              </div>

              {linkItems.length > 0 ? (
                <div className={styles.itemsList}>
                  {linkItems.map((item, idx) => (
                    <div key={`${item.url}-${idx}`} className={styles.listItem}>
                      <div className={styles.itemContent}>
                        <span className={styles.itemTitle}>🔗 {item.label}</span>
                        <span className={styles.itemSubtitle}>{item.url}</span>
                      </div>
                      <button type="button" className={styles.removeButton} onClick={() => removeLink(idx)}>
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
            </section>

            <section className={styles.submitCard}>
              <span className={styles.cardEyebrow}>{t("addRecipeReviewEyebrow")}</span>
              <h2 className={styles.submitTitle}>{t("addRecipeReviewTitle")}</h2>
              <p className={styles.submitText}>{t("saveRecipeHint")}</p>
              <div className={styles.submitMeta}>
                <span className={styles.submitChip}>{t("requiredBadge")}</span>
                <span className={styles.submitChip}>{t("recipeTypesLabel")}</span>
                <span className={styles.submitChip}>{t("optionalBadge")}</span>
              </div>
              {error ? <p className={styles.error} aria-live="polite">{error}</p> : null}
              <div className={styles.submitActions}>
                <button className={styles.primaryButton} disabled={isSubmitting}>
                  {isSubmitting ? t("savingRecipe") : t("saveRecipeButton")}
                </button>
              </div>
            </section>
          </div>
        </form>
      </main>
    </>
  );
}
