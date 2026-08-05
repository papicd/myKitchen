"use client";

import {
  useCallback,
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { ErrorDialog } from "../components/ErrorDialog";
import { Toast } from "../components/Toast";
import en from "../translations/en.json";
import sr from "../translations/sr.json";
import { ApiError } from "./api";
import { AuthResponse, User } from "./types";

type ToastState = {
  title: string;
  message: string;
  variant?: "info" | "success" | "error";
};

type ErrorDialogState = {
  title: string;
  description: string;
  actionLabel?: string;
};

function resolveFriendlyApiMessage(
  error: unknown,
  fallbackMessage: string,
  t: (key: string) => string,
) {
  if (error instanceof ApiError) {
    if (error.status === 0) {
      return t("networkErrorFriendly");
    }

    if (error.status >= 500) {
      return t("serverErrorFriendly");
    }

    return error.message || fallbackMessage;
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallbackMessage;
}

type AuthContextValue = {
  user: User | null;
  token: string | null;
  isLoggedIn: boolean;
  language: 'en' | 'sr';
  setLanguage: (lang: 'en' | 'sr') => void;
  saveAuth: (auth: AuthResponse) => void;
  logout: () => void;
  logoutOnExpiry: () => void;
  showToast: (toast: ToastState) => void;
  showSuccess: (message: string, title?: string) => void;
  showApiError: (error: unknown, fallbackMessage?: string) => void;
  closeErrorDialog: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function isJwtExpired(jwt: string) {
  try {
    const payload = JSON.parse(atob(jwt.split(".")[1]));
    return typeof payload.exp === "number" && Date.now() >= payload.exp * 1000;
  } catch {
    return false;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [errorDialog, setErrorDialog] = useState<ErrorDialogState | null>(null);
  const [language, setLanguageState] = useState<'en' | 'sr'>('sr');

  const dictionary = (language === "en" ? en : sr) as Record<string, string>;
  const t = useCallback(
    (key: string) => dictionary[key] ?? String(key),
    [dictionary],
  );

  const logout = useCallback(() => {
    localStorage.removeItem("authToken");
    localStorage.removeItem("authUser");
    setToken(null);
    setUser(null);
  }, []);

  const logoutOnExpiry = useCallback((message = t("reAuthRequired")) => {
    logout();
    setToast({ title: t("tokenExpired"), message, variant: "error" });
  }, [logout, t]);

  const showToast = useCallback((nextToast: ToastState) => {
    setToast(nextToast);
  }, []);

  const showSuccess = useCallback(
    (message: string, title = t("success")) => {
      setToast({ title, message, variant: "success" });
    },
    [t],
  );

  const showApiError = useCallback(
    (error: unknown, fallbackMessage = t("requestFailed")) => {
      const message = resolveFriendlyApiMessage(error, fallbackMessage, t);

      setToast({
        title: t("requestFailed"),
        message,
        variant: "error",
      });
      setErrorDialog({
        title: t("somethingWentWrongTitle"),
        description: message,
        actionLabel: language === "en" ? "Close" : "Zatvori",
      });
    },
    [language, t],
  );

  const closeErrorDialog = useCallback(() => {
    setErrorDialog(null);
  }, []);

  const setLanguage = useCallback((lang: 'en' | 'sr') => {
    setLanguageState(lang);
    localStorage.setItem("language", lang);
  }, []);

  useEffect(() => {
    const savedToken = localStorage.getItem("authToken");
    const savedUser = localStorage.getItem("authUser");
    const savedLanguage = localStorage.getItem("language") as 'en' | 'sr' | null;

    if (savedLanguage) {
      setLanguageState(savedLanguage);
    }

    if (savedToken && savedUser) {
      if (isJwtExpired(savedToken)) {
        logoutOnExpiry();
        return;
      }

      try {
        setToken(savedToken);
        setUser(JSON.parse(savedUser) as User);
      } catch {
        // Corrupted localStorage auth payload should not break app startup.
        logout();
      }
    }
  }, [logout, logoutOnExpiry]);

  useEffect(() => {
    const handleExpired = () => logoutOnExpiry();
    window.addEventListener("auth:expired", handleExpired);
    return () => window.removeEventListener("auth:expired", handleExpired);
  }, [logoutOnExpiry]);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timeout = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      isLoggedIn: Boolean(user && token),
      language,
      setLanguage,
      saveAuth(auth) {
        localStorage.setItem("authToken", auth.token);
        localStorage.setItem("authUser", JSON.stringify(auth.user));
        setToken(auth.token);
        setUser(auth.user);
      },
      logout,
      logoutOnExpiry: () => logoutOnExpiry(),
      showToast,
      showSuccess,
      showApiError,
      closeErrorDialog,
    }),
    [closeErrorDialog, logout, logoutOnExpiry, showApiError, showSuccess, showToast, user, token, language, setLanguage],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
        {toast ? (
          <Toast title={toast.title} message={toast.message} variant={toast.variant} />
        ) : null}
        {errorDialog ? (
          <ErrorDialog
            title={errorDialog.title}
            description={errorDialog.description}
            actionLabel={errorDialog.actionLabel}
            onAction={closeErrorDialog}
          />
        ) : null}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}
