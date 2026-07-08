"use client";

import { useTranslation } from "../lib/useTranslation";
import styles from "./PageSpinner.module.scss";

type PageSpinnerProps = {
  label?: string;
  fullPage?: boolean;
};

export function PageSpinner({
  label,
  fullPage = false,
}: PageSpinnerProps) {
  const { t } = useTranslation();

  return (
    <div className={`${styles.wrap} ${fullPage ? styles.fullPage : ""}`}>
      <span className={styles.spinner} aria-hidden="true" />
      <span className={styles.label}>{label ?? t("loading")}</span>
    </div>
  );
}

