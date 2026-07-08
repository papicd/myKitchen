"use client";

import { useTranslation } from "../lib/useTranslation";
import styles from "./StarRating.module.scss";

type StarRatingProps = {
  averageRating: number;
  ratingsCount: number;
  currentUserRating?: number | null;
  interactive?: boolean;
  disabled?: boolean;
  onRate?: (value: number) => void;
  helperText?: string;
};

export function StarRating({
  averageRating,
  ratingsCount,
  currentUserRating = null,
  interactive = false,
  disabled = false,
  onRate,
  helperText,
}: StarRatingProps) {
  const { t } = useTranslation();
  const activeValue = interactive ? currentUserRating ?? 0 : Math.round(averageRating);

  return (
    <div className={styles.wrap}>
      <div className={styles.stars}>
        {Array.from({ length: 5 }, (_, index) => {
          const value = index + 1;
          const filled = value <= activeValue;

          if (!interactive) {
            return (
              <span
                key={value}
                className={`${styles.starStatic} ${filled ? styles.filled : ""}`}
                aria-hidden="true"
              >
                ★
              </span>
            );
          }

          return (
            <button
              key={value}
              type="button"
              className={`${styles.starButton} ${filled ? styles.filled : ""}`}
              onClick={() => onRate?.(value)}
              disabled={disabled}
              aria-label={t("rateWithStars", { value })}
            >
              ★
            </button>
          );
        })}
      </div>

      <span className={styles.summary}>
        {ratingsCount > 0
          ? t("ratingsSummary", { average: averageRating.toFixed(1), count: ratingsCount })
          : t("noRatings")}
      </span>

      {helperText ? <span className={styles.helper}>{helperText}</span> : null}
    </div>
  );
}

