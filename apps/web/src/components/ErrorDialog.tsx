"use client";

import { useTranslation } from "../lib/useTranslation";
import styles from "./ErrorDialog.module.scss";

type Props = {
  title: string;
  description: string;
  actionLabel?: string;
  onAction: () => void;
};

export function ErrorDialog({ title, description, actionLabel, onAction }: Props) {
  const { t } = useTranslation();

  return (
    <div className={styles.overlay} onClick={onAction}>
      <div
        className={styles.dialog}
        onClick={(event) => event.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="error-dialog-title"
        aria-describedby="error-dialog-description"
      >
        <div className={styles.header}>
          <div className={styles.icon} aria-hidden="true">
            !
          </div>
          <div>
            <h2 id="error-dialog-title" className={styles.title}>
              {title}
            </h2>
            <p id="error-dialog-description" className={styles.description}>
              {description}
            </p>
          </div>
        </div>
        <div className={styles.actions}>
          <button className={styles.button} type="button" onClick={onAction}>
            {actionLabel ?? t("close")}
          </button>
        </div>
      </div>
    </div>
  );
}

