"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { Avatar } from "../../components/Avatar";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { PageSpinner } from "../../components/PageSpinner";
import { RecipeTypeBadges } from "../../components/RecipeTypeBadges";
import {
  deleteRecipe,
  getFollowingUsers,
  getMyRecipes,
  getNotifications,
  getUserProfile,
  markAllNotificationsRead,
  markNotificationRead,
  updateMyProfile,
} from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { useTranslation } from "../../lib/useTranslation";
import { AdminUser, RecipeListItem, UserNotification } from "../../lib/types";
import styles from "../page.module.scss";

type ProfileForm = {
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  avatarUrl: string;
};

type PasswordForm = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

export default function ProfilePage() {
  const { user, token, isLoggedIn, saveAuth, showApiError, showSuccess } = useAuth();
  const { t } = useTranslation();
  const [recipes, setRecipes] = useState<RecipeListItem[]>([]);
  const [profileSummary, setProfileSummary] = useState<AdminUser | null>(null);
  const [followingUsers, setFollowingUsers] = useState<AdminUser[]>([]);
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [recipeError, setRecipeError] = useState("");
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [markingAllRead, setMarkingAllRead] = useState(false);
  const [busyNotificationId, setBusyNotificationId] = useState<string | null>(null);
  const [profileForm, setProfileForm] = useState<ProfileForm>({
    firstName: "",
    lastName: "",
    username: "",
    email: "",
    avatarUrl: "",
  });
  const [passwordForm, setPasswordForm] = useState<PasswordForm>({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [profileSaving, setProfileSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  useEffect(() => {
    if (!user) return;

    setProfileForm({
      firstName: user.firstName,
      lastName: user.lastName,
      username: user.username,
      email: user.email,
      avatarUrl: user.avatarUrl ?? "",
    });
  }, [user]);

  useEffect(() => {
    if (!token || !user) {
      setLoading(false);
      return;
    }

    Promise.all([
      getMyRecipes(token),
      getUserProfile(user.id, token),
      getFollowingUsers(token),
      getNotifications(token),
    ])
      .then(([recipeItems, summary, following, notificationResponse]) => {
        setRecipes(recipeItems);
        setProfileSummary(summary);
        setFollowingUsers(following);
        setNotifications(notificationResponse.items);
        setUnreadCount(notificationResponse.unreadCount);
      })
      .catch((err) => {
        setRecipeError(t("cannotLoadUserRecipes"));
        showApiError(err, t("cannotLoadUserRecipes"));
      })
      .finally(() => setLoading(false));
  }, [showApiError, token, t, user]);

  async function handleProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;

    setProfileSaving(true);

    try {
      const auth = await updateMyProfile(profileForm, token);
      saveAuth(auth);
      setProfileSummary((current) =>
        current
          ? {
              ...current,
              ...auth.user,
            }
          : current,
      );
      showSuccess(t("profileUpdated"));
    } catch (err) {
      showApiError(err, t("profileUpdateFailed"));
    } finally {
      setProfileSaving(false);
    }
  }

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;

    setPasswordError("");

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError(t("passwordsDoNotMatch"));
      return;
    }

    setPasswordSaving(true);

    try {
      const auth = await updateMyProfile(
        {
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        },
        token,
      );
      saveAuth(auth);
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      showSuccess(t("passwordUpdated"));
    } catch (err) {
      showApiError(err, t("passwordUpdateFailed"));
    } finally {
      setPasswordSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteId || !token) return;
    setDeleting(true);
    try {
      await deleteRecipe(deleteId, token);
      const updatedRecipes = await getMyRecipes(token);
      setRecipes(updatedRecipes);
      setDeleteId(null);
      showSuccess(t("recipeDeletedSuccess"));
    } catch (err) {
      setDeleteId(null);
      showApiError(err, t("deleteError"));
    } finally {
      setDeleting(false);
    }
  }

  async function handleMarkNotificationRead(notificationId: string) {
    if (!token) return;

    setBusyNotificationId(notificationId);
    try {
      const updated = await markNotificationRead(notificationId, token);
      setNotifications((current) => current.map((item) => (item.id === notificationId ? updated : item)));
      setUnreadCount((current) => Math.max(0, current - 1));
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
      showSuccess(t("notificationsMarkedRead"));
    } catch (err) {
      showApiError(err, t("notificationReadFailed"));
    } finally {
      setMarkingAllRead(false);
    }
  }

  if (!isLoggedIn || !user) {
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
    <>
      {deleteId ? (
        <ConfirmDialog
          title={t("deleteRecipeTitle")}
          description={t("deleteConfirmMessage")}
          confirmLabel={t("deleteRecipeButton")}
          loading={deleting}
          onConfirm={handleDelete}
          onCancel={() => setDeleteId(null)}
        />
      ) : null}

      <main className={styles.page}>
        <header className={styles.pageHeader}>
          <div>
            <h1>{t("profileTitle")}</h1>
            <p>{t("profileDescription")}</p>
          </div>
        </header>

        <section className={styles.profileOverview}>
          <article className={styles.profileHeroCard}>
            <Avatar
              name={user.username}
              avatarUrl={user.avatarUrl}
              className={styles.profileAvatar}
            />
            <div>
              <h2>@{user.username}</h2>
              <p>{user.email}</p>
              <p className={styles.smallMuted}>{t("avatarProfileHint")}</p>
            </div>
          </article>
          <div className={styles.profileStats}>
            <article>
              <strong>{recipes.length}</strong>
              <span>{t("myRecipesSection")}</span>
            </article>
            <article>
              <strong>{followingUsers.length}</strong>
              <span>{t("following")}</span>
            </article>
            <article>
              <strong>{profileSummary?.followersCount ?? 0}</strong>
              <span>{t("followers")}</span>
            </article>
            <article>
              <strong>{unreadCount}</strong>
              <span>{t("notifications")}</span>
            </article>
          </div>
        </section>

        <section className={styles.profileSettingsGrid}>
          <article className={styles.card}>
            <h2>{t("accountDetails")}</h2>
            <p className={styles.hint}>{t("accountDetailsHint")}</p>
            <form className={styles.form} onSubmit={handleProfileSubmit}>
              <div className={styles.field}>
                <label htmlFor="firstName">{t("firstName")}</label>
                <input
                  id="firstName"
                  value={profileForm.firstName}
                  onChange={(event) =>
                    setProfileForm((current) => ({ ...current, firstName: event.target.value }))
                  }
                  required
                />
              </div>
              <div className={styles.field}>
                <label htmlFor="lastName">{t("lastName")}</label>
                <input
                  id="lastName"
                  value={profileForm.lastName}
                  onChange={(event) =>
                    setProfileForm((current) => ({ ...current, lastName: event.target.value }))
                  }
                  required
                />
              </div>
              <div className={styles.field}>
                <label htmlFor="username">{t("username")}</label>
                <input
                  id="username"
                  value={profileForm.username}
                  onChange={(event) =>
                    setProfileForm((current) => ({ ...current, username: event.target.value }))
                  }
                  required
                />
              </div>
              <div className={styles.field}>
                <label htmlFor="email">{t("email")}</label>
                <input
                  id="email"
                  type="email"
                  value={profileForm.email}
                  onChange={(event) =>
                    setProfileForm((current) => ({ ...current, email: event.target.value }))
                  }
                  required
                />
              </div>
              <div className={styles.field}>
                <label htmlFor="avatarUrl">{t("avatarUrlLabel")}</label>
                <input
                  id="avatarUrl"
                  type="url"
                  value={profileForm.avatarUrl}
                  placeholder={t("avatarUrlPlaceholder")}
                  onChange={(event) =>
                    setProfileForm((current) => ({ ...current, avatarUrl: event.target.value }))
                  }
                />
              </div>
              <button className={styles.button} type="submit" disabled={profileSaving}>
                {profileSaving ? t("saving") : t("saveChangesButton")}
              </button>
            </form>
          </article>

          <article className={styles.card}>
            <h2>{t("changePassword")}</h2>
            <p className={styles.hint}>{t("changePasswordHint")}</p>
            <form className={styles.form} onSubmit={handlePasswordSubmit}>
              <div className={styles.field}>
                <label htmlFor="currentPassword">{t("currentPassword")}</label>
                <input
                  id="currentPassword"
                  type="password"
                  value={passwordForm.currentPassword}
                  onChange={(event) =>
                    setPasswordForm((current) => ({ ...current, currentPassword: event.target.value }))
                  }
                  required
                />
              </div>
              <div className={styles.field}>
                <label htmlFor="newPassword">{t("newPassword")}</label>
                <input
                  id="newPassword"
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={(event) =>
                    setPasswordForm((current) => ({ ...current, newPassword: event.target.value }))
                  }
                  required
                  minLength={2}
                />
              </div>
              <div className={styles.field}>
                <label htmlFor="confirmPassword">{t("confirmPassword")}</label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={(event) =>
                    setPasswordForm((current) => ({ ...current, confirmPassword: event.target.value }))
                  }
                  required
                  minLength={2}
                />
              </div>
              {passwordError ? <p className={styles.error}>{passwordError}</p> : null}
              <button className={styles.button} type="submit" disabled={passwordSaving}>
                {passwordSaving ? t("saving") : t("updatePassword")}
              </button>
            </form>
          </article>
        </section>

        <section className={styles.card}>
          <div className={styles.cardFooter}>
            <div>
              <h2>{t("following")}</h2>
              <p className={styles.hint}>{t("followingDescription")}</p>
            </div>
          </div>
          {loading ? <PageSpinner label={t("loadingProfile")} /> : null}
          {!loading && followingUsers.length === 0 ? (
            <p className={styles.muted}>{t("noFollowingUsers")}</p>
          ) : null}
          {!loading && followingUsers.length > 0 ? (
            <div className={styles.profileFollowList}>
              {followingUsers.map((followedUser) => (
                <div key={followedUser.id} className={styles.profileFollowItem}>
                  <div className={styles.profileFollowMeta}>
                    <Avatar
                      name={followedUser.username}
                      avatarUrl={followedUser.avatarUrl}
                      className={styles.profileInlineAvatar}
                    />
                    <div>
                      <strong>@{followedUser.username}</strong>
                      <p className={styles.smallMuted}>
                        {followedUser.firstName} {followedUser.lastName}
                      </p>
                    </div>
                  </div>
                  <Link className={styles.subtleButton} href={`/profile/${followedUser.id}`}>
                    {t("viewUserProfile")}
                  </Link>
                </div>
              ))}
            </div>
          ) : null}
        </section>

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
          {!loading && notifications.length === 0 ? (
            <p className={styles.muted}>{t("noNotifications")}</p>
          ) : null}
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
                      <strong>
                        {notification.type === "comment"
                          ? t("notificationCommentTitle")
                          : t("notificationFollowedPostTitle")}
                      </strong>
                      <p className={styles.smallMuted}>
                        @{notification.actor.username}
                        {notification.recipe ? ` · ${notification.recipe.title}` : ""}
                      </p>
                      {notification.commentText ? (
                        <p>{notification.commentText}</p>
                      ) : null}
                      <p className={styles.smallMuted}>
                        {new Date(notification.createdAt).toLocaleString()}
                      </p>
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

        <section className={styles.card}>
          <h2>{t("myRecipesSection")}</h2>
          {recipeError ? <p className={styles.error}>{recipeError}</p> : null}
          {loading && !recipeError ? <PageSpinner label={t("loadingMyRecipes")} /> : null}
          {!loading ? (
            recipes.length === 0 ? (
              <p className={styles.muted}>{t("noRecipesAdded")}</p>
            ) : (
              <div className={styles.grid}>
                {recipes.map((recipe) => (
                  <div key={recipe.id} className={styles.cardWrapper}>
                    <Link
                      className={`${styles.card} ${styles.recipeCard}`}
                      href={`/recipes/${recipe.id}`}
                    >
                      <h3>{recipe.title}</h3>
                      <p>{recipe.shortDescription}</p>
                      <RecipeTypeBadges types={recipe.types} maxVisible={3} />
                      <div className={styles.cardFooter}>
                        <span className={styles.authorLink}>
                          <Avatar
                            name={recipe.author.username}
                            avatarUrl={recipe.author.avatarUrl}
                            className={styles.avatar}
                          />
                          <span>@{recipe.author.username}</span>
                        </span>
                      </div>
                    </Link>
                    <button
                      className={styles.deleteBtn}
                      type="button"
                      title={t("deleteRecipeButton")}
                      onClick={() => setDeleteId(recipe.id)}
                    >
                      🗑
                    </button>
                  </div>
                ))}
              </div>
            )
          ) : null}
        </section>
      </main>
    </>
  );
}
