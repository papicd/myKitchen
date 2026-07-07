import { AdminUser, AuthResponse, RecipeDetails, RecipeListItem } from "./types";

export class AuthError extends Error {
  constructor(message = "Morate se ponovo prijaviti") {
    super(message);
    this.name = "AuthError";
  }
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

type RequestOptions = {
  token?: string | null;
  body?: unknown;
  method?: string;
};

async function request<T>(path: string, options: RequestOptions = {}) {
  const method = options.method ?? (options.body ? "POST" : "GET");
  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    if (response.status === 401) {
      if (options.token && typeof window !== "undefined") {
        window.dispatchEvent(new Event("auth:expired"));
      }

      throw new AuthError(data?.message ?? "Token je istekao");
    }

    throw new Error(data?.message ?? "Zahtev nije uspeo");
  }

  return data as T;
}

export function login(email: string, password: string) {
  return request<AuthResponse>("/auth/login", { body: { email, password } });
}

export function signup(body: {
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  password: string;
}) {
  return request<AuthResponse>("/auth/register", { body });
}

export function getRecipes() {
  return request<RecipeListItem[]>("/recipes");
}

export function getRecipe(id: string, token: string) {
  return request<RecipeDetails>(`/recipes/${id}`, { token });
}

export function searchRecipes(query: string, token: string) {
  return request<RecipeListItem[]>(
    `/recipes/search?q=${encodeURIComponent(query)}`,
    { token },
  );
}

export function getMyRecipes(token: string) {
  return request<RecipeListItem[]>("/recipes/mine", { token });
}

export function getSavedRecipes(token: string) {
  return request<RecipeListItem[]>("/recipes/saved", { token });
}

export function getRatedRecipes(token: string) {
  return request<RecipeListItem[]>("/recipes/rated", { token });
}

export function toggleSaveRecipe(id: string, token: string) {
  return request<{ saved: boolean }>(`/recipes/${id}/save`, { token, method: "POST" });
}

export function getUserRecipes(userId: string) {
  return request<RecipeListItem[]>(`/recipes/by-user/${userId}`);
}

export function getUserProfile(userId: string) {
  return request<AdminUser>(`/users/${userId}`);
}

export function createRecipe(
  body: {
    title: string;
    shortDescription: string;
    description: string;
    ingredients: string[];
    steps: string[];
    preparationTime: string;
    servings: string;
    media?: Array<{ type: 'image' | 'video'; url: string }>;
    links?: Array<{ label: string; url: string }>;
  },
  token: string,
) {
  return request<RecipeDetails>("/recipes", { token, body });
}

export function deleteRecipe(id: string, token: string) {
  return request<{ success: boolean }>(`/recipes/${id}`, { token, method: "DELETE" });
}

export function updateRecipe(
  id: string,
  body: {
    title: string;
    shortDescription: string;
    description: string;
    ingredients: string[];
    steps: string[];
    preparationTime: string;
    servings: string;
    media?: Array<{ type: 'image' | 'video'; url: string }>;
    links?: Array<{ label: string; url: string }>;
  },
  token: string,
) {
  return request<RecipeDetails>(`/recipes/${id}`, { token, body, method: "PUT" });
}

export function rateRecipe(id: string, value: number, token: string) {
  return request<RecipeDetails>(`/recipes/${id}/rating`, {
    token,
    body: { value },
    method: "POST",
  });
}

export function getUsers(token: string) {
  return request<AdminUser[]>("/users", { token });
}

export function updateUserRecommendation(
  id: string,
  isRecommended: boolean,
  token: string,
) {
  return request<AdminUser>(`/users/${id}/recommendation`, {
    token,
    body: { isRecommended },
    method: "PATCH",
  });
}

