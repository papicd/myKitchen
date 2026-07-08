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
import { Toast } from "../components/Toast";
import en from "../translations/en.json";
import sr from "../translations/sr.json";
import { AuthResponse, User } from "./types";

type AuthContextValue = {
  user: User | null;
  token: string | null;
  isLoggedIn: boolean;
  language: 'en' | 'sr';
  setLanguage: (lang: 'en' | 'sr') => void;
  saveAuth: (auth: AuthResponse) => void;
  logout: () => void;
  logoutOnExpiry: () => void;
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
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [language, setLanguageState] = useState<'en' | 'sr'>('sr');

  const dictionary = language === "en" ? en : sr;
  const t = useCallback(
    (key: keyof typeof sr) => dictionary[key] ?? String(key),
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
    setToastMessage(message);
  }, [logout, t]);

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

      setToken(savedToken);
      setUser(JSON.parse(savedUser) as User);
    }
  }, [logoutOnExpiry]);

  useEffect(() => {
    const handleExpired = () => logoutOnExpiry();
    window.addEventListener("auth:expired", handleExpired);
    return () => window.removeEventListener("auth:expired", handleExpired);
  }, [logoutOnExpiry]);

  useEffect(() => {
    if (!toastMessage) {
      return;
    }

    const timeout = window.setTimeout(() => setToastMessage(null), 3500);
    return () => window.clearTimeout(timeout);
  }, [toastMessage]);

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
    }),
    [logout, logoutOnExpiry, user, token, language, setLanguage],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
      {toastMessage ? (
        <Toast title={t("tokenExpired")} message={toastMessage} />
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
