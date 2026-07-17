"use client";

import Link from "next/link";
import { useTranslation } from "../lib/useTranslation";
import { useAuth } from "../lib/auth";
import styles from "./page.module.scss";

export default function Home() {
  const { t } = useTranslation();
  const { isLoggedIn } = useAuth();

  const ingredientExamples = t("ingredientsFieldPlaceholder").split(" ").slice(0, 3);

  const featureCards = [
    {
      icon: "🍲",
      title: t("dailyRecipesTitle"),
      description: t("dailyRecipesDescription"),
      href: "/recipes",
      action: t("homeFeature1"),
    },
    {
      icon: "🥕",
      title: t("ingredientsTitle"),
      description: t("ingredientsDescription"),
      href: isLoggedIn ? "/find" : "/login",
      action: isLoggedIn ? t("homeFeature2") : t("login"),
    },
    {
      icon: "🧑‍🍳",
      title: t("myKitchenTitle"),
      description: t("myKitchenDescription"),
      href: isLoggedIn ? "/add-recipe" : "/signup",
      action: isLoggedIn ? t("addRecipe") : t("register"),
    },
  ];

  const quickLinks = [
    {
      badge: "01",
      title: t("recipesTitle"),
      description: t("recipesBasicInfo"),
      href: "/recipes",
      action: t("homeFeature1"),
    },
    {
      badge: "02",
      title: t("findTitle"),
      description: t("findDescription"),
      href: isLoggedIn ? "/find" : "/login",
      action: isLoggedIn ? t("searchButton") : t("login"),
    },
    {
      badge: "03",
      title: t("findWithAITitle"),
      description: t("findWithAIDescription"),
      href: isLoggedIn ? "/find-ai" : "/login",
      action: isLoggedIn ? t("findWithAI") : t("login"),
    },
    {
      badge: "04",
      title: isLoggedIn ? t("addRecipeTitle") : t("registerTitle"),
      description: isLoggedIn ? t("addRecipeDescription") : t("registerDescription"),
      href: isLoggedIn ? "/add-recipe" : "/signup",
      action: isLoggedIn ? t("saveRecipeButton") : t("register"),
    },
  ];
  return (
    <main className={styles.page}>
      <section className={styles.homeHero}>
        <div className={styles.homeHeroContent}>
          <span className={styles.eyebrow}>{t("homeTitle")}</span>
          <h1>{t("homeSubtitle")}</h1>
          <p className={styles.homeLead}>{t("intro")}</p>

          <div className={styles.heroActions}>
            <Link href="/recipes">{t("homeFeature1")}</Link>
            <Link
              href={isLoggedIn ? "/find" : "/login"}
              className={styles.heroSecondaryAction}
            >
              {isLoggedIn ? t("homeFeature2") : t("login")}
            </Link>
            <Link
              href={isLoggedIn ? "/find-ai" : "/signup"}
              className={styles.heroGhostAction}
            >
              {isLoggedIn ? t("findWithAI") : t("register")}
            </Link>
          </div>

          <div className={styles.heroStats}>
            <article className={styles.heroStat}>
              <strong>01</strong>
              <span>{t("recipes")}</span>
            </article>
            <article className={styles.heroStat}>
              <strong>02</strong>
              <span>{t("findByIngredients")}</span>
            </article>
            <article className={styles.heroStat}>
              <strong>03</strong>
              <span>{isLoggedIn ? t("findWithAI") : t("register")}</span>
            </article>
          </div>
        </div>

        <div className={styles.homeHeroVisual}>
          <article className={styles.heroShowcase}>
            <span className={styles.showcaseBadge}>{t("appName")}</span>
            <h2>{t("dailyRecipesTitle")}</h2>
            <p>{t("dailyRecipesDescription")}</p>
            <div className={styles.showcaseChips}>
              <span>🥘 {t("recipes")}</span>
              <span>⭐ {t("recommendedUsers")}</span>
              <span>🧠 {t("findWithAI")}</span>
            </div>
          </article>

          <article className={styles.showcaseRecipeCard}>
            <span className={styles.showcaseCardLabel}>{t("findTitle")}</span>
            <h3>{t("ingredientsTitle")}</h3>
            <p>{t("ingredientsDescription")}</p>
            <ul className={styles.ingredientChips}>
              {ingredientExamples.map((ingredient) => (
                <li key={ingredient}>{ingredient}</li>
              ))}
            </ul>
          </article>

          <div className={styles.showcaseAside}>
            <article className={styles.miniShowcaseCard}>
              <span>{t("myKitchenTitle")}</span>
              <strong>{t("addRecipe")}</strong>
            </article>
            <article className={styles.miniShowcaseCard}>
              <span>{t("findWithAITitle")}</span>
              <strong>{t("findWithAIDescription")}</strong>
            </article>
          </div>
        </div>
      </section>

      <section className={styles.homeSection}>
        <div className={styles.sectionIntro}>
          <span className={styles.sectionKicker}>{t("homeTitle")}</span>
          <h2>{t("recipesTitle")}</h2>
          <p>{t("recipesBasicInfo")}</p>
        </div>

        <div className={styles.featureGrid}>
          {featureCards.map((card) => (
            <article key={card.title} className={styles.homeFeatureCard}>
              <span className={styles.featureIcon}>{card.icon}</span>
              <h3>{card.title}</h3>
              <p>{card.description}</p>
              <Link href={card.href} className={styles.inlineLink}>
                {card.action}
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.homeSection}>
        <div className={styles.sectionIntro}>
          <span className={styles.sectionKicker}>{t("appName")}</span>
          <h2>{t("myKitchenTitle")}</h2>
          <p>{t("myKitchenDescription")}</p>
        </div>

        <div className={styles.quickGrid}>
          {quickLinks.map((link) => (
            <article key={link.badge} className={styles.quickCard}>
              <div className={styles.quickCardTop}>
                <span className={styles.quickCardBadge}>{link.badge}</span>
                <span className={styles.quickCardArrow}>↗</span>
              </div>
              <h3>{link.title}</h3>
              <p>{link.description}</p>
              <Link href={link.href} className={styles.inlineLink}>
                {link.action}
              </Link>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
