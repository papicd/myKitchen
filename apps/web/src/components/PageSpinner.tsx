import styles from "./PageSpinner.module.scss";

type PageSpinnerProps = {
  label?: string;
  fullPage?: boolean;
};

export function PageSpinner({
  label = "Ucitavanje...",
  fullPage = false,
}: PageSpinnerProps) {
  return (
    <div className={`${styles.wrap} ${fullPage ? styles.fullPage : ""}`}>
      <span className={styles.spinner} aria-hidden="true" />
      <span className={styles.label}>{label}</span>
    </div>
  );
}

