"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Avatar } from "../../components/Avatar";
import { PageSpinner } from "../../components/PageSpinner";
import { getNotifications, markAllNotificationsRead, markNotificationRead } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { UserNotification } from "../../lib/types";
import { useTranslation } from "../../lib/useTranslation";
import styles from "../page.module.scss";

function dispatchNotificationsChanged() {
  window.dispatchEvent(new Event("notifications:changed"));
}

export default function NotificationsPage() {
  const { token, isLoggedIn, showApiError, showSuccess } = useAuth();
  const { t } = useTranslation();
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [markingAllRead, setMarkingAllRead] = useState(false);
  const [busyNotificationId, setBusyNotificationId] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !isLoggedIn) {
      setLoading(false);
      return;
    }

    getNotifications(token)
      .then((response) => {
        setNotifications(response.items);
        setUnreadCount(response.unreadCount);
      })
      .catch((err) => showApiError(err, t("cannotLoadUserRecipes")))
      .finally(() => setLoading(false));
  }, [isLoggedIn, showApiError, t, token]);

  async function handleMarkNotificationRead(notificationId: string) {
    if (!token) return;

    setBusyNotificationId(notificationId);
    try {
      const updated = await markNotificationRead(notificationId, token);
      setNotifications((current) => current.map((item) => (item.id === notificationId ? updated : item)));
      setUnreadCount((current) => Math.max(0, current - 1));
      dispatchNotificationsChanged();
    } catch (err) {
      showApiError(err, t("notificationReadFailed"));
    } finally {
      setBusyNotificationId(null);
    }
  }

  async function handleMarkAllNotificationsRead() {
    if (!token || unreadCount === 0) return;

    setMarkingAllRead(true);
    try {
      await markAllNotificationsRead(token);
      setNotifications((current) => current.map((item) => ({ ...item, isRead: true })));
      setUnreadCount(0);
      dispatchNotificationsChanged();
      showSuccess(t("notificationsMarkedRead"));
    } catch (err) {
      showApiError(err, t("notificationReadFailed"));
    } finally {
      setMarkingAllRead(false);
    }
  }

  function getNotificationTitle(notification: UserNotification) {
    if (notification.type === "comment") return t("notificationCommentTitle");
    if (notification.type === "followed_author_post") return t("notificationFollowedPostTitle");
    if (notification.type === "follow") return t("notificationFollowTitle");
    if (notification.type === "recipe_rated") return t("notificationRecipeRatedTitle");
    if (notification.type === "saved_recipe_updated") return t("notificationSavedRecipeUpdatedTitle");
    return t("notificationRecipeSavedTitle");
  }

  if (!isLoggedIn) {
    return (
      <main className={styles.page}>
        <section className={styles.card}>
          <h1>{t("profileNotAvailable")}</h1>
          <div className={styles.actions}>
            <Link href="/login">{t("login")}</Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <h1>{t("notifications")}</h1>
          <p>{t("notificationsDescription")}</p>
        </div>
      </header>

      <section className={styles.card}>
        <div className={styles.cardFooter}>
          <div>
            <h2>{t("notifications")}</h2>
            <p className={styles.hint}>{t("notificationsDescription")}</p>
          </div>
          <button
            type="button"
            className={styles.subtleButton}
            onClick={handleMarkAllNotificationsRead}
            disabled={markingAllRead || unreadCount === 0}
          >
            {markingAllRead ? t("saving") : t("markAllAsRead")}
          </button>
        </div>

        {loading ? <PageSpinner label={t("loadingProfile")} /> : null}
        {!loading && notifications.length === 0 ? <p className={styles.muted}>{t("noNotifications")}</p> : null}

        {!loading && notifications.length > 0 ? (
          <div className={styles.notificationList}>
            {notifications.map((notification) => (
              <div key={notification.id} className={styles.notificationItem}>
                <div className={styles.notificationMeta}>
                  {!notification.isRead ? <span className={styles.unreadDot} /> : null}
                  <Avatar
                    name={notification.actor.username}
                    avatarUrl={notification.actor.avatarUrl}
                    className={styles.profileInlineAvatar}
                  />
                  <div>
                    <strong>{getNotificationTitle(notification)}</strong>
                    <p className={styles.smallMuted}>
                      @{notification.actor.username}
                      {notification.recipe ? ` · ${notification.recipe.title}` : ""}
                    </p>
                    {notification.commentText ? <p>{notification.commentText}</p> : null}
                    <p className={styles.smallMuted}>{new Date(notification.createdAt).toLocaleString()}</p>
                  </div>
                </div>
                {!notification.isRead ? (
                  <button
                    type="button"
                    className={styles.subtleButton}
                    onClick={() => handleMarkNotificationRead(notification.id)}
                    disabled={busyNotificationId === notification.id}
                  >
                    {busyNotificationId === notification.id ? t("saving") : t("markAsRead")}
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
      </section>
    </main>
  );
}
