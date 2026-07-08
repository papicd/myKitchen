"use client";

import Link from "next/link";
import { useTranslation } from "../lib/useTranslation";
import styles from "./page.module.scss";

export default function Home() {
  const { t } = useTranslation();

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div>
          <span className={styles.eyebrow}>{t("homeTitle")}</span>
          <h1>{t("homeSubtitle")}</h1>
          <p>
            {t("intro")}
          </p>
          <div className={styles.heroActions}>
            <Link href="/recipes">{t("homeFeature1")}</Link>
            <Link href="/find">{t("homeFeature2")}</Link>
          </div>
        </div>
      </section>

      <section className={styles.featureGrid}>
        <article>
          <h2>{t("dailyRecipesTitle")}</h2>
          <p>{t("dailyRecipesDescription")}</p>
        </article>
        <article>
          <h2>{t("ingredientsTitle")}</h2>
          <p>{t("ingredientsDescription")}</p>
        </article>
        <article>
          <h2>{t("myKitchenTitle")}</h2>
          <p>{t("myKitchenDescription")}</p>
        </article>
      </section>
    </main>
  );
}
