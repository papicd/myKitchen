"use client";

import { useTranslation } from "../lib/useTranslation";
import styles from "./PageSpinner.module.scss";

type PageSpinnerProps = {
  label?: string;
  fullPage?: boolean;
  size?: "sm" | "md" | "lg";
};

export function PageSpinner({
  label,
  fullPage = false,
  size = "md",
}: PageSpinnerProps) {
  const { t } = useTranslation();
  const sizeClass =
    size === "sm" ? styles.sizeSm : size === "lg" ? styles.sizeLg : styles.sizeMd;

  return (
    <div
      className={`${styles.wrap} ${fullPage ? styles.fullPage : ""}`}
      role="status"
      aria-live="polite"
    >
      <span className={`${styles.spinner} ${sizeClass}`} aria-hidden="true">
        <span className={styles.spinnerCore} />
      </span>
      <span className={styles.label}>{label ?? t("loading")}</span>
    </div>
  );
}
