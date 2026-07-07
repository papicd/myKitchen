"use client";

import Link from "next/link";
import { useState } from "react";
import { useAuth } from "../lib/auth";
import styles from "./Header.module.scss";

export function Header() {
  const { user, isLoggedIn, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const close = () => setMenuOpen(false);

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <div className={styles.topRow}>
          <Link className={styles.brand} href="/" onClick={close}>
            Moja Kuhinja
          </Link>
          <button
            className={styles.menuToggle}
            type="button"
            aria-label="Toggle menu"
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
            <Link href="/" onClick={close}>Pocetna</Link>
            <Link href="/recipes" onClick={close}>Recepti</Link>
            {isLoggedIn ? <Link href="/my-recipes" onClick={close}>Moji recepti</Link> : null}
            {isLoggedIn ? <Link href="/find" onClick={close}>Pronadji jelo</Link> : null}
            {isLoggedIn ? <Link href="/find-ai" onClick={close}>Pronadji sa AI</Link> : null}
            {isLoggedIn ? <Link href="/add-recipe" onClick={close}>Dodaj recept</Link> : null}
            {user?.isAdmin ? <Link href="/admin/users" onClick={close}>Preporuke</Link> : null}
          </nav>

          <div className={styles.actions}>
            {isLoggedIn ? (
              <>
                <Link className={styles.profile} href="/profile" title="Profil" onClick={close}>
                  P
                </Link>
                <button
                  className={styles.logout}
                  type="button"
                  onClick={() => { logout(); close(); }}
                >
                  Odjava
                </button>
              </>
            ) : (
              <>
                <Link href="/login" onClick={close}>Prijava</Link>
                <Link className={styles.primary} href="/signup" onClick={close}>
                  Registracija
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
