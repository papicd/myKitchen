import styles from "./Toast.module.scss";

type ToastProps = {
  title: string;
  message: string;
};

export function Toast({ title, message }: ToastProps) {
  return (
    <div className={styles.toast} role="status" aria-live="polite">
      <p className={styles.title}>{title}</p>
      <p className={styles.message}>{message}</p>
    </div>
  );
}

