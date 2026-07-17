"use client";

import Link from "next/link";
import { useState } from "react";
import { useAuth } from "../lib/auth";
import { useTranslation } from "../lib/useTranslation";
import styles from "./Header.module.scss";

export function Header() {
  const { user, isLoggedIn, logout } = useAuth();
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const profileInitials = user
    ? `${user.firstName.slice(0, 1)}${user.lastName.slice(0, 1)}`.toUpperCase()
    : "MK";

  const close = () => setMenuOpen(false);

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <div className={styles.topRow}>
          <Link className={styles.brand} href="/" onClick={close}>
            <span className={styles.brandMark} aria-hidden="true">
              🍲
            </span>
            <span className={styles.brandText}>
              <strong>{t("appName")}</strong>
              <small>{t("homeTitle")}</small>
            </span>
          </Link>
          <button
            className={styles.menuToggle}
            type="button"
            aria-label={t("toggleMenu")}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <span />
            <span />
            <span />
          </button>
        </div>

        <div className={`${styles.navWrapper} ${menuOpen ? styles.open : ""}`}>
          <nav className={styles.nav}>
            <Link href="/" onClick={close}>{t("home")}</Link>
            <Link href="/recipes" onClick={close}>{t("recipes")}</Link>
            {isLoggedIn ? <Link href="/my-recipes" onClick={close}>{t("myRecipes")}</Link> : null}
            {isLoggedIn ? <Link href="/find" onClick={close}>{t("findByIngredients")}</Link> : null}
            {isLoggedIn ? <Link href="/add-recipe" onClick={close}>{t("addRecipe")}</Link> : null}
            {user?.isAdmin ? <Link href="/admin/users" onClick={close}>{t("recommendations")}</Link> : null}
          </nav>

          <div className={styles.actions}>
            {isLoggedIn ? (
              <>
                <Link className={styles.profile} href="/profile" title={t("profile")} onClick={close}>
                  {profileInitials}
                </Link>
                <button
                  className={styles.logout}
                  type="button"
                  onClick={() => { logout(); close(); }}
                >
                  {t("logout")}
                </button>
              </>
            ) : (
              <>
                <Link href="/login" onClick={close}>{t("login")}</Link>
                <Link className={styles.primary} href="/signup" onClick={close}>
                  {t("register")}
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
