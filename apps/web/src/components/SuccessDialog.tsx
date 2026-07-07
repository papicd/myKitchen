import styles from "./SuccessDialog.module.scss";

type Props = {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction: () => void;
};

export function SuccessDialog({
  title,
  description,
  actionLabel = "Nastavi",
  onAction,
}: Props) {
  return (
    <div className={styles.overlay} onClick={onAction}>
      <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.icon}>✓</div>
          <div>
            <h2 className={styles.title}>{title}</h2>
            {description && <p className={styles.description}>{description}</p>}
          </div>
        </div>
        <div className={styles.actions}>
          <button className={styles.button} type="button" onClick={onAction}>
            {actionLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

