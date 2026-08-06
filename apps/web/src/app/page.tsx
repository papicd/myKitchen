"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Avatar } from "../components/Avatar";
import { getActivityFeed } from "../lib/api";
import { ActivityFeedItem } from "../lib/types";
import { useTranslation } from "../lib/useTranslation";
import { useAuth } from "../lib/auth";
import styles from "./page.module.scss";

export default function Home() {
  const { t, language } = useTranslation();
  const { isLoggedIn, token } = useAuth();
  const [feedItems, setFeedItems] = useState<ActivityFeedItem[]>([]);
  const [loadingFeed, setLoadingFeed] = useState(false);
  const isSr = language === "sr";

  useEffect(() => {
    if (!token || !isLoggedIn) {
      setFeedItems([]);
      setLoadingFeed(false);
      return;
    }

    setLoadingFeed(true);
    getActivityFeed(token)
      .then((items) => setFeedItems(items.slice(0, 6)))
      .catch(() => setFeedItems([]))
      .finally(() => setLoadingFeed(false));
  }, [isLoggedIn, token]);

  const heroHighlights = isSr
    ? ["Pametne pretrage", "AI predlozi", "Laka organizacija obroka"]
    : ["Smart search", "AI suggestions", "Easy meal planning"];

  const featureCards = [
    {
      icon: "✨",
      title: t("recipesTitle"),
      description: t("recipesBasicInfo"),
      href: "/recipes",
      action: t("homeFeature1"),
    },
    {
      icon: "🥬",
      title: t("findTitle"),
      description: t("findDescription"),
      href: isLoggedIn ? "/find" : "/login",
      action: isLoggedIn ? t("searchButton") : t("login"),
    },
    {
      icon: "🧠",
      title: t("findWithAITitle"),
      description: t("findWithAIDescription"),
      href: isLoggedIn ? "/find-ai" : "/login",
      action: isLoggedIn ? t("findWithAI") : t("login"),
    },
    {
      icon: "📝",
      title: t("addRecipeTitle"),
      description: t("addRecipeReviewTitle"),
      href: isLoggedIn ? "/add-recipe" : "/signup",
      action: isLoggedIn ? t("saveRecipeButton") : t("register"),
    },
  ];

  const flow = [
    {
      step: "01",
      title: isSr ? "Izaberi namirnice" : "Pick ingredients",
      description: isSr
        ? "Unesi ono sto vec imas kod kuce i odmah suzi izbor."
        : "Enter what you already have at home and narrow choices instantly.",
    },
    {
      step: "02",
      title: isSr ? "Uporedi recepte" : "Compare recipes",
      description: isSr
        ? "Pogledaj ocene, vreme pripreme i preporucene autore."
        : "Review ratings, prep time, and recommended authors.",
    },
    {
      step: "03",
      title: isSr ? "Sacuvaj i kuvaj" : "Save and cook",
      description: isSr
        ? "Sacuvaj favorite, vrati im se kasnije i podeli svoj recept."
        : "Save favorites, revisit them later, and share your own recipe.",
    },
  ];

  const ctaHref = isLoggedIn ? "/recipes" : "/signup";
  const ctaLabel = isLoggedIn ? t("homeFeature1") : t("register");

  return (
    <main className={styles.page}>
      <section className={styles.homeWrap}>
        <article className={styles.heroPanel}>
          <div className={styles.heroContent}>
            <span className={styles.kicker}>{t("appName")}</span>
            <h1>{t("homeSubtitle")}</h1>
            <p>{t("intro")}</p>

            <ul className={styles.heroHighlights}>
              {heroHighlights.map((highlight) => (
                <li key={highlight}>{highlight}</li>
              ))}
            </ul>

            <div className={styles.heroCtas}>
              <Link href="/recipes" className={styles.primaryCta}>{t("homeFeature1")}</Link>
              <Link href={isLoggedIn ? "/find" : "/login"} className={styles.secondaryCta}>
                {isLoggedIn ? t("searchButton") : t("login")}
              </Link>
              <Link href={isLoggedIn ? "/find-ai" : "/signup"} className={styles.ghostCta}>
                {isLoggedIn ? t("findWithAI") : t("register")}
              </Link>
            </div>
          </div>

          <div className={styles.heroMetrics}>
            <article>
              <strong>150+</strong>
              <span>{isSr ? "inspiracija za obroke" : "meal inspirations"}</span>
            </article>
            <article>
              <strong>3x</strong>
              <span>{isSr ? "brze pretrage" : "faster discovery"}</span>
            </article>
            <article>
              <strong>24/7</strong>
              <span>{isSr ? "planiranje kuhinje" : "kitchen planning"}</span>
            </article>
          </div>

          <aside className={styles.heroAssistant}>
            <div className={styles.assistantHead}>
              <span>{t("findWithAITitle")}</span>
              <strong>{isSr ? "Kuhinjski asistent" : "Kitchen Assistant"}</strong>
            </div>
            <ul className={styles.assistantFeed}>
              <li>
                <p>{isSr ? "Predlog obroka za danas" : "Meal idea for today"}</p>
                <span>{isSr ? "Na osnovu piletine i pirinca" : "Based on chicken and rice"}</span>
              </li>
              <li>
                <p>{isSr ? "Brza priprema" : "Quick prep"}</p>
                <span>{isSr ? "Do 30 minuta" : "Up to 30 minutes"}</span>
              </li>
              <li>
                <p>{isSr ? "Pametna preporuka" : "Smart recommendation"}</p>
                <span>{isSr ? "Recept sa najboljim ocenama" : "Top-rated recipe match"}</span>
              </li>
            </ul>
          </aside>
        </article>
      </section>

      {/*<section className={styles.exploreSection}>*/}
      {/*  <header className={styles.sectionHeader}>*/}
      {/*    <span>{isSr ? "Sve na jednom mestu" : "Everything in one place"}</span>*/}
      {/*    <h2>{isSr ? "Od ideje do tanjira" : "From idea to plate"}</h2>*/}
      {/*  </header>*/}
      {/*  <div className={styles.exploreGrid}>*/}
      {/*    {featureCards.map((card) => (*/}
      {/*      <article key={card.title} className={styles.exploreCard}>*/}
      {/*        <div className={styles.exploreCardTop}>*/}
      {/*          <span>{card.icon}</span>*/}
      {/*          <Link href={card.href}>{card.action}</Link>*/}
      {/*        </div>*/}
      {/*        <h3>{card.title}</h3>*/}
      {/*        <p>{card.description}</p>*/}
      {/*      </article>*/}
      {/*    ))}*/}
      {/*  </div>*/}
      {/*</section>*/}

      {/*<section className={styles.flowSection}>*/}
      {/*  <header className={styles.sectionHeader}>*/}
      {/*    <span>{isSr ? "Kako radi" : "How it works"}</span>*/}
      {/*    <h2>{isSr ? "Tri jednostavna koraka" : "Three simple steps"}</h2>*/}
      {/*  </header>*/}
      {/*  <div className={styles.flowGrid}>*/}
      {/*    {flow.map((item) => (*/}
      {/*      <article key={item.step} className={styles.flowCard}>*/}
      {/*        <strong>{item.step}</strong>*/}
      {/*        <h3>{item.title}</h3>*/}
      {/*        <p>{item.description}</p>*/}
      {/*      </article>*/}
      {/*    ))}*/}
      {/*  </div>*/}
      {/*</section>*/}

      <section className={styles.bottomCta}>
        <div>
          <span>{t("appName")}</span>
          <h2>
            {isSr
              ? "Spreman/na za sledeci obrok?"
              : "Ready for your next meal?"}
          </h2>
          <p>
            {isSr
              ? "Pronadji recepte za danas, sacuvaj favorite i napravi svoj licni kuvarski kutak."
              : "Discover ideas for today, save favorites, and build your own cooking space."}
          </p>
        </div>
        <Link href={ctaHref}>{ctaLabel}</Link>
      </section>

      <section className={styles.homeFeedSection}>
        <header className={styles.sectionHeader}>
          <span>{isSr ? "Personalizovano" : "Personalized"}</span>
          <h2>{isSr ? "Aktivnost autora koje pratite" : "Activity from authors you follow"}</h2>
        </header>

        {!isLoggedIn ? (
          <article className={styles.homeFeedEmpty}>
            <p>
              {isSr
                ? "Prijavite se i zapratite preporucene autore kako biste videli njihov feed aktivnosti."
                : "Sign in and follow recommended authors to see their activity feed."}
            </p>
            <Link href="/login">{t("login")}</Link>
          </article>
        ) : null}

        {isLoggedIn && loadingFeed ? (
          <article className={styles.homeFeedEmpty}>
            <p>{t("loading")}</p>
          </article>
        ) : null}

        {isLoggedIn && !loadingFeed && feedItems.length === 0 ? (
          <article className={styles.homeFeedEmpty}>
            <p>{t("emptyActivityFeed")}</p>
            <Link href="/recipes">{t("recipes")}</Link>
          </article>
        ) : null}

        {isLoggedIn && !loadingFeed && feedItems.length > 0 ? (
          <div className={styles.homeFeedList}>
            {feedItems.map((item) => (
              <article key={item.id} className={styles.homeFeedCard}>
                <div className={styles.homeFeedMeta}>
                  <Avatar
                    name={item.actor.username}
                    avatarUrl={item.actor.avatarUrl}
                    className={styles.homeFeedAvatar}
                  />
                  <div>
                    <strong>
                      {item.type === "recipe_created"
                        ? t("feedRecipeCreated", { username: item.actor.username })
                        : item.type === "recipe_rated"
                          ? t("feedRecipeRated", {
                              username: item.actor.username,
                              rating: item.ratingValue ?? "-",
                            })
                          : t("feedRecipeCommented", { username: item.actor.username })}
                    </strong>
                    <p>
                      <Link href={`/recipes/${item.recipe.id}`}>{item.recipe.title}</Link>
                    </p>
                    <p>{new Date(item.createdAt).toLocaleString()}</p>
                  </div>
                </div>
                <Link href={`/profile/${item.actor.id}`}>{t("viewUserProfile")}</Link>
              </article>
            ))}
          </div>
        ) : null}
      </section>
    </main>
  );
}
