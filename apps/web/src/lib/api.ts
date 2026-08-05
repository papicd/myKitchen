import {
  ActivityFeedItem,
  AdminUser,
  AuthResponse,
  NotificationsResponse,
  PaginatedAdminUsers,
  RecipeCollection,
  RecipeBrowseFilters,
  RecipeBrowseResponse,
  RecipeDetails,
  RecipeListItem,
  RecipeType,
} from "./types";

export class AuthError extends Error {
  constructor(message = "Morate se ponovo prijaviti") {
    super(message);
    this.name = "AuthError";
  }
}

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

let recipeTypesCache: RecipeType[] | null = null;
let recipeTypesPromise: Promise<RecipeType[]> | null = null;

type RequestOptions = {
  token?: string | null;
  body?: unknown;
  method?: string;
};

async function request<T>(path: string, options: RequestOptions = {}) {
  const method = options.method ?? (options.body ? "POST" : "GET");
  let response: Response;

  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new ApiError("Ne možemo da uspostavimo vezu sa serverom.", 0);
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    if (response.status === 401) {
      if (options.token && typeof window !== "undefined") {
        window.dispatchEvent(new Event("auth:expired"));
      }

      throw new AuthError(data?.message ?? "Token je istekao");
    }

    throw new ApiError(data?.message ?? "Zahtev nije uspeo", response.status);
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

export function forgotPassword(email: string) {
  return request<{ success: boolean; devResetLink?: string }>("/auth/forgot-password", {
    body: { email },
  });
}

export function resetPassword(token: string, newPassword: string) {
  return request<{ success: boolean }>("/auth/reset-password", {
    body: { token, newPassword },
  });
}

export function getRecipes() {
  return request<RecipeListItem[]>("/recipes");
}

export function getRecipesPage(filters: RecipeBrowseFilters = {}) {
  const params = new URLSearchParams();

  if (filters.query?.trim()) {
    params.set("query", filters.query.trim());
  }

  if (filters.groceries?.trim()) {
    params.set("groceries", filters.groceries.trim());
  }

  if (Array.isArray(filters.typeIds) && filters.typeIds.length > 0) {
    params.set("typeIds", filters.typeIds.join(","));
  }

  if (typeof filters.minRating === "number") {
    params.set("minRating", String(filters.minRating));
  }

  if (typeof filters.maxPreparationMinutes === "number") {
    params.set("maxPreparationMinutes", String(filters.maxPreparationMinutes));
  }

  if (typeof filters.recommendedOnly === "boolean") {
    params.set("recommendedOnly", String(filters.recommendedOnly));
  }

  if (typeof filters.page === "number") {
    params.set("page", String(filters.page));
  }

  if (typeof filters.limit === "number") {
    params.set("limit", String(filters.limit));
  }

  if (filters.sort) {
    params.set("sort", filters.sort);
  }

  const query = params.toString();
  return request<RecipeBrowseResponse>(`/recipes/browse${query ? `?${query}` : ""}`);
}

export function getRecipe(id: string, token: string) {
  return request<RecipeDetails>(`/recipes/${id}`, { token });
}

export function searchRecipes(query: string, token: string, typeIds: string[] = []) {
  const params = new URLSearchParams();
  params.set("q", query);

  if (typeIds.length > 0) {
    params.set("typeIds", typeIds.join(","));
  }

  return request<RecipeListItem[]>(`/recipes/search?${params.toString()}`, { token });
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

export function getUserProfile(userId: string, token?: string | null) {
  return request<AdminUser>(`/users/${userId}`, { token });
}

export function updateMyProfile(
  body: {
    firstName?: string;
    lastName?: string;
    username?: string;
    email?: string;
    avatarUrl?: string;
    currentPassword?: string;
    newPassword?: string;
  },
  token: string,
) {
  return request<AuthResponse>('/users/me', { token, body, method: 'PATCH' });
}

export function toggleFollowUser(id: string, token: string) {
  return request<{ following: boolean; user: AdminUser }>(`/users/${id}/follow`, {
    token,
    method: 'POST',
  });
}

export function getFollowingUsers(token: string) {
  return request<AdminUser[]>('/users/me/following', { token });
}

export function getActivityFeed(token: string) {
  return request<ActivityFeedItem[]>('/users/me/feed', { token });
}

export function getRecipeCollections(token: string) {
  return request<RecipeCollection[]>('/users/me/collections', { token });
}

export function createRecipeCollection(name: string, token: string) {
  return request<RecipeCollection>('/users/me/collections', {
    token,
    body: { name },
    method: 'POST',
  });
}

export function renameRecipeCollection(id: string, name: string, token: string) {
  return request<RecipeCollection>(`/users/me/collections/${id}`, {
    token,
    body: { name },
    method: 'PATCH',
  });
}

export function deleteRecipeCollection(id: string, token: string) {
  return request<{ success: boolean }>(`/users/me/collections/${id}`, {
    token,
    method: 'DELETE',
  });
}

export function addRecipeToCollection(collectionId: string, recipeId: string, token: string) {
  return request<RecipeCollection>(`/users/me/collections/${collectionId}/recipes`, {
    token,
    body: { recipeId },
    method: 'POST',
  });
}

export function removeRecipeFromCollection(collectionId: string, recipeId: string, token: string) {
  return request<RecipeCollection>(`/users/me/collections/${collectionId}/recipes/${recipeId}`, {
    token,
    method: 'DELETE',
  });
}

export function getNotifications(token: string) {
  return request<NotificationsResponse>('/users/me/notifications', { token });
}

export function markNotificationRead(id: string, token: string) {
  return request<NotificationsResponse['items'][number]>(`/users/me/notifications/${id}/read`, {
    token,
    method: 'PATCH',
  });
}

export function markAllNotificationsRead(token: string) {
  return request<{ success: boolean }>('/users/me/notifications/read-all', {
    token,
    method: 'PATCH',
  });
}

export function createRecipe(
  body: {
    title: string;
    shortDescription: string;
    description?: string;
    ingredients: string[];
    steps: string[];
    preparationTime?: string;
    servings?: string;
    typeIds: string[];
    media?: Array<{ type: 'image' | 'video' | 'pdf'; url: string }>;
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
    description?: string;
    ingredients: string[];
    steps: string[];
    preparationTime?: string;
    servings?: string;
    typeIds: string[];
    media?: Array<{ type: 'image' | 'video' | 'pdf'; url: string }>;
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

export function addRecipeComment(id: string, text: string, token: string) {
  return request<RecipeDetails>(`/recipes/${id}/comments`, {
    token,
    body: { text },
    method: "POST",
  });
}

export function getUsers(
  token: string,
  filters: { query?: string; page?: number; limit?: number } = {},
) {
  const params = new URLSearchParams();

  if (filters.query?.trim()) {
    params.set("query", filters.query.trim());
  }

  if (typeof filters.page === "number") {
    params.set("page", String(filters.page));
  }

  if (typeof filters.limit === "number") {
    params.set("limit", String(filters.limit));
  }

  const query = params.toString();
  return request<PaginatedAdminUsers>(`/users${query ? `?${query}` : ""}`, { token });
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

export function updateUserAdmin(
  id: string,
  isAdmin: boolean,
  token: string,
) {
  return request<AdminUser>(`/users/${id}/admin`, {
    token,
    body: { isAdmin },
    method: "PATCH",
  });
}

export function getRecipeTypes() {
  if (recipeTypesCache) {
    return Promise.resolve(recipeTypesCache);
  }

  if (recipeTypesPromise) {
    return recipeTypesPromise;
  }

  recipeTypesPromise = request<RecipeType[]>('/recipes/types')
    .then((types) => {
      recipeTypesCache = types;
      return types;
    })
    .finally(() => {
      recipeTypesPromise = null;
    });

  return recipeTypesPromise;
}

export function createRecipeType(
  body: { name: string; color: string },
  token: string,
) {
  return request<RecipeType>('/recipes/types', {
    token,
    body,
    method: 'POST',
  }).then((created) => {
    recipeTypesCache = recipeTypesCache
      ? [...recipeTypesCache, created].sort((a, b) => a.name.localeCompare(b.name))
      : [created];
    return created;
  });
}
