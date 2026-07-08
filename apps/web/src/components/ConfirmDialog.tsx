"use client";

import { useTranslation } from "../lib/useTranslation";
import styles from "./ConfirmDialog.module.scss";

type Props = {
  title: string;
  description: string;
  confirmLabel?: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  title,
  description,
  confirmLabel,
  loading = false,
  onConfirm,
  onCancel,
}: Props) {
  const { t } = useTranslation();

  return (
    <div className={styles.overlay} onClick={onCancel}>
      <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.icon}>⚠️</div>
          <h2 className={styles.title}>{title}</h2>
        </div>
        <p className={styles.description}>{description}</p>
        <div className={styles.actions}>
          <button
            className={styles.cancel}
            type="button"
            onClick={onCancel}
            disabled={loading}
          >
            {t("cancel")}
          </button>
          <button
            className={styles.confirm}
            type="button"
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? t("deleting") : (confirmLabel ?? t("delete"))}
          </button>
        </div>
      </div>
    </div>
  );
}

