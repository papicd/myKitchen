import styles from "./Toast.module.scss";

type ToastProps = {
  title: string;
  message: string;
  variant?: "info" | "success" | "error";
};

export function Toast({ title, message, variant = "info" }: ToastProps) {
  return (
    <div className={`${styles.toast} ${styles[variant]}`} role="status" aria-live="polite">
      <p className={styles.title}>{title}</p>
      <p className={styles.message}>{message}</p>
    </div>
  );
}

