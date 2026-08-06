"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import { PageSpinner } from "../../../components/PageSpinner";
import { RecipeTypeMultiSelect } from "../../../components/RecipeTypeMultiSelect";
import { SuccessDialog } from "../../../components/SuccessDialog";
import { createRecipeType, getRecipe, getRecipeTypes, updateRecipe } from "../../../lib/api";
import { useAuth } from "../../../lib/auth";
import { useTranslation } from "../../../lib/useTranslation";
import { RecipeDetails, RecipeType } from "../../../lib/types";
import styles from "../../page.module.scss";

type MediaItem = { type: 'image' | 'video' | 'pdf'; url: string };
type LinkItem = { label: string; url: string };

const INGREDIENTS_SEPARATOR = /[,\n]+/;
const STEPS_SEPARATOR = /\n+/;

function normalizeText(value: FormDataEntryValue | null) {
  return String(value ?? '').trim();
}

function parseList(value: FormDataEntryValue | null, separator: RegExp) {
  return normalizeText(value)
    .split(separator)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseTextList(value: string, separator: RegExp) {
  return value
    .trim()
    .split(separator)
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function EditRecipePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user, token, isLoggedIn, showApiError, showSuccess } = useAuth();
  const { t } = useTranslation();
  const [recipe, setRecipe] = useState<RecipeDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);

  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaType, setMediaType] = useState<'image' | 'video' | 'pdf'>('image');

  const [linkItems, setLinkItems] = useState<LinkItem[]>([]);
  const [linkLabel, setLinkLabel] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [recipeTypes, setRecipeTypes] = useState<RecipeType[]>([]);
  const [selectedTypeIds, setSelectedTypeIds] = useState<string[]>([]);
  const [newTypeName, setNewTypeName] = useState("");
  const [newTypeColor, setNewTypeColor] = useState("#22C55E");
  const [stepsValue, setStepsValue] = useState("");
  const stepsRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!isLoggedIn || !token) return;

    let isMounted = true;

    getRecipe(params.id, token)
      .then((data) => {
        if (isMounted) {
          setRecipe(data);
          setMediaItems(data.media || []);
          setLinkItems(data.links || []);
          setSelectedTypeIds(data.types.map((type) => type.id));
          setStepsValue(data.steps.join("\n"));
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err instanceof Error ? err.message : t("cannotLoadRecipe"));
          showApiError(err, t("cannotLoadRecipe"));
        }
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isLoggedIn, params.id, showApiError, t, token]);

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

  const canEdit = recipe && user && (user.isAdmin || recipe.createdBy === user.id);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!recipe || !token || !canEdit) return;

    setError("");
    setSubmitting(true);

    if (selectedTypeIds.length === 0) {
      setError(t("pickAtLeastOneType"));
      setSubmitting(false);
      return;
    }

    const form = event.currentTarget;
    const formData = new FormData(form);
    const title = normalizeText(formData.get('title'));
    const shortDescription = normalizeText(formData.get('shortDescription'));
    const description = normalizeText(formData.get('description'));
    const ingredients = parseList(formData.get('ingredients'), INGREDIENTS_SEPARATOR);
    const steps = parseTextList(stepsValue, STEPS_SEPARATOR);
    const preparationTime = normalizeText(formData.get('preparationTime'));
    const servings = normalizeText(formData.get('servings'));

    if (!title || !shortDescription) {
      setError(t('completeRequiredFields'));
      setSubmitting(false);
      return;
    }

    if (ingredients.length === 0) {
      setError(t('addAtLeastOneIngredient'));
      setSubmitting(false);
      return;
    }

    if (steps.length === 0) {
      setError(t('addAtLeastOneStep'));
      setSubmitting(false);
      return;
    }

    try {
      await updateRecipe(
        params.id,
        {
          title,
          shortDescription,
          ...(description ? { description } : {}),
          ingredients,
          steps,
          ...(preparationTime ? { preparationTime } : {}),
          ...(servings ? { servings } : {}),
          typeIds: selectedTypeIds,
          media: mediaItems,
          links: linkItems,
        },
        token,
      );
      showSuccess(t("recipeUpdated"));
      setShowSuccessDialog(true);
    } catch (err) {
      showApiError(err, t("updateFailed"));
    } finally {
      setSubmitting(false);
    }
  }

  function addMedia() {
    if (!mediaUrl.trim()) {
      setError(t('enterMediaUrl'));
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
                reject(new Error(t('unsupportedFileFormat', { fileName: file.name })));
                return;
              }

              const reader = new FileReader();
              reader.onload = () => {
                if (typeof reader.result !== "string") {
                  reject(new Error(t('cannotLoadFile', { fileName: file.name })));
                  return;
                }

                resolve({ type: media, url: reader.result });
              };
              reader.onerror = () => reject(new Error(t('errorReadingFile', { fileName: file.name })));
              reader.readAsDataURL(file);
            }),
        ),
      );

      setMediaItems((prev) => [...prev, ...items]);
      setError("");
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : t('uploadFailed'));
    } finally {
      event.target.value = "";
    }
  }

  function removeMedia(index: number) {
    setMediaItems(mediaItems.filter((_, i) => i !== index));
  }

  function formatSelectedStepText(style: "bold" | "italic") {
    const textarea = stepsRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    if (start === end) return;

    const marker = style === "bold" ? "**" : "*";
    const selected = stepsValue.slice(start, end);
    const nextValue = `${stepsValue.slice(0, start)}${marker}${selected}${marker}${stepsValue.slice(end)}`;
    setStepsValue(nextValue);

    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(start + marker.length, end + marker.length);
    });
  }

  function addLink() {
    if (!linkLabel.trim() || !linkUrl.trim()) {
      setError(t('enterLinkDetails'));
      return;
    }
    setLinkItems([...linkItems, { label: linkLabel, url: linkUrl }]);
    setLinkLabel("");
    setLinkUrl("");
  }

  function removeLink(index: number) {
    setLinkItems(linkItems.filter((_, i) => i !== index));
  }

  async function handleCreateType() {
    if (!token || !user?.isAdmin) {
      return;
    }

    try {
      const created = await createRecipeType(
        {
          name: newTypeName,
          color: newTypeColor,
        },
        token,
      );
      setRecipeTypes((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      setSelectedTypeIds((prev) => [...prev, created.id]);
      setNewTypeName("");
      showSuccess(t("recipeTypeCreated"));
    } catch (typeError) {
      showApiError(typeError, t("cannotCreateRecipeType"));
    }
  }

  if (loading) {
    return (
      <main className={styles.page}>
        <PageSpinner label={t('loadingRecipeDetails')} />
      </main>
    );
  }

  if (!isLoggedIn) {
    return (
      <main className={styles.page}>
        <section className={styles.card}>
          <h1>{t('needLoginToEdit')}</h1>
          <div className={styles.actions}>
            <Link href="/login">{t('login')}</Link>
          </div>
        </section>
      </main>
    );
  }

  if (!recipe || !canEdit) {
    return (
      <main className={styles.page}>
        <section className={styles.card}>
          <h1>{t('noPermissionEdit')}</h1>
          <div className={styles.actions}>
            <Link href="/recipes">{t('backToRecipes')}</Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <>
      {showSuccessDialog ? (
        <SuccessDialog
          title={t('recipeUpdated')}
          description={t('changesUpdated')}
          actionLabel={t('viewRecipe')}
          onAction={() => router.push(`/recipes/${params.id}`)}
        />
      ) : null}

      <main className={styles.page}>
        <header className={styles.pageHeader}>
          <div>
            <h1>{t('editRecipeTitle')}</h1>
            <p>{t('editRecipeDescription')}</p>
          </div>
        </header>

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label htmlFor="title">{t('recipeNameLabel')}</label>
            <input id="title" name="title" defaultValue={recipe.title} required />
          </div>
          <div className={styles.field}>
            <label htmlFor="shortDescription">{t('shortDescriptionLabel')}</label>
            <input id="shortDescription" name="shortDescription" defaultValue={recipe.shortDescription} required />
          </div>
          <div className={styles.field}>
            <label htmlFor="description">{t('detailedDescriptionLabel')}</label>
            <textarea id="description" name="description" defaultValue={recipe.description} />
          </div>
          <div className={styles.field}>
            <label htmlFor="ingredients">{t('ingredientsLabel')}</label>
            <textarea id="ingredients" name="ingredients" defaultValue={recipe.ingredients.join(", ")} required />
          </div>
          <div className={styles.field}>
            <label htmlFor="steps">{t('stepsLabel')}</label>
            <div className={styles.textFormatToolbar}>
              <span>{t("formatSelection")}</span>
              <button type="button" className={styles.textFormatButton} onClick={() => formatSelectedStepText("bold")}>
                <strong>B</strong> {t("bold")}
              </button>
              <button type="button" className={styles.textFormatButton} onClick={() => formatSelectedStepText("italic")}>
                <em>I</em> {t("italic")}
              </button>
            </div>
            <textarea
              id="steps"
              name="steps"
              ref={stepsRef}
              value={stepsValue}
              onChange={(event) => setStepsValue(event.target.value)}
              required
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="preparationTime">{t('preparationTimeLabel')}</label>
            <input id="preparationTime" name="preparationTime" defaultValue={recipe.preparationTime} />
          </div>
          <div className={styles.field}>
            <label htmlFor="servings">{t('servingsLabel')}</label>
            <input id="servings" name="servings" defaultValue={recipe.servings} />
          </div>

          <div className={styles.field}>
            <label htmlFor="typeIds">{t("recipeTypesLabel")}</label>
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
            <p className={styles.hint}>{t("recipeTypesHint")}</p>
          </div>

          {user?.isAdmin ? (
            <div className={styles.section}>
              <h3>{t("addRecipeTypeTitle")}</h3>
              <div className={styles.field}>
                <label htmlFor="newTypeName">{t("recipeTypeNameLabel")}</label>
                <input
                  id="newTypeName"
                  value={newTypeName}
                  onChange={(event) => setNewTypeName(event.target.value)}
                  placeholder={t("recipeTypeNamePlaceholder")}
                />
              </div>
              <div className={styles.field}>
                <label htmlFor="newTypeColor">{t("recipeTypeColorLabel")}</label>
                <input
                  id="newTypeColor"
                  type="color"
                  value={newTypeColor}
                  onChange={(event) => setNewTypeColor(event.target.value.toUpperCase())}
                />
              </div>
              <button type="button" className={styles.secondaryBtn} onClick={() => void handleCreateType()}>
                {t("addRecipeTypeButton")}
              </button>
            </div>
          ) : null}

          <div className={styles.section}>
            <h3>{t('mediaSection')}</h3>
            <p className={styles.hint}>{t('mediaHint')}</p>
            <div className={styles.field}>
              <label htmlFor="mediaFiles">{t('uploadFilesLabel')}</label>
              <input
                id="mediaFiles"
                type="file"
                accept="image/*,video/*,application/pdf"
                multiple
                onChange={handleLocalMediaUpload}
              />
            </div>
            <div className={styles.field}>
              <label>{t('mediaTypeLabel')}</label>
              <select value={mediaType} onChange={(e) => setMediaType(e.target.value as 'image' | 'video' | 'pdf')}>
                <option value="image">{t('image')}</option>
                <option value="video">{t('video')}</option>
                <option value="pdf">{t('pdf')}</option>
              </select>
            </div>
            <div className={styles.field}>
              <label>{t('mediaUrlLabel')}</label>
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
              {t('addMediaButton')}
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
            <h3>{t('linksSection')}</h3>
            <p className={styles.hint}>{t('linksHint')}</p>
            <div className={styles.field}>
              <label>{t('linkLabelField')}</label>
              <input
                value={linkLabel}
                onChange={(e) => setLinkLabel(e.target.value)}
                placeholder={t('linkLabelPlaceholder')}
              />
            </div>
            <div className={styles.field}>
              <label>{t('linkUrlField')}</label>
              <input
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>
            <button type="button" className={styles.secondaryBtn} onClick={addLink}>
              {t('addLinkButton')}
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
          <button className={styles.button} disabled={submitting}>
            {submitting ? t('savingChanges') : t('saveChangesButton')}
          </button>
        </form>
      </main>
    </>
  );
}

