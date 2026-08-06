"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Avatar } from "./Avatar";
import { getNotifications } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useTranslation } from "../lib/useTranslation";
import styles from "./Header.module.scss";

export function Header() {
  const { user, token, isLoggedIn, logout } = useAuth();
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const usernameSeed = String(user?.username ?? "").replace(/[^a-z0-9]/gi, "");
  const profileInitials = user
    ? usernameSeed.slice(0, 2).toUpperCase() || "MK"
    : "MK";

  const close = () => setMenuOpen(false);

  useEffect(() => {
    if (!token || !isLoggedIn) {
      setUnreadCount(0);
      return;
    }

    const refreshUnreadCount = () => {
      getNotifications(token)
        .then((response) => setUnreadCount(response.unreadCount))
        .catch(() => setUnreadCount(0));
    };

    refreshUnreadCount();
    window.addEventListener("notifications:changed", refreshUnreadCount);
    return () => window.removeEventListener("notifications:changed", refreshUnreadCount);
  }, [isLoggedIn, token]);

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
            {isLoggedIn ? <Link href="/collections" onClick={close}>{t("collections")}</Link> : null}
            {isLoggedIn ? <Link href="/find" onClick={close}>{t("findByIngredients")}</Link> : null}
            {isLoggedIn ? <Link href="/add-recipe" onClick={close}>{t("addRecipe")}</Link> : null}
            {user?.isAdmin ? <Link href="/admin/users" onClick={close}>{t("adminPanel")}</Link> : null}
            <Link href="/contact" onClick={close}>{t("contact")}</Link>
          </nav>

          <div className={styles.actions}>
            {isLoggedIn ? (
              <>
                <Link className={styles.notificationWrap} href="/notifications" title={t("notifications")} onClick={close}>
                  <span aria-hidden="true">🔔</span>
                  {unreadCount > 0 ? (
                    <span className={styles.notificationBadge}>{unreadCount > 9 ? "9+" : unreadCount}</span>
                  ) : null}
                </Link>
                <Link className={styles.profileWrap} href="/profile" title={t("profile")} onClick={close}>
                  <Avatar
                    name={user?.username ?? "User"}
                    avatarUrl={user?.avatarUrl}
                    className={styles.profile}
                    imageClassName={styles.profileImage}
                    fallbackText={profileInitials}
                  />
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
