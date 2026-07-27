export type User = {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  isAdmin: boolean;
  isRecommended: boolean;
};

export type AdminUser = User & {
  recipeCount: number;
};

export type PaginatedAdminUsers = {
  items: AdminUser[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasMore: boolean;
  query: string;
};

export type AuthResponse = {
  token: string;
  user: User;
};

export type Media = {
  type: 'image' | 'video' | 'pdf';
  url: string;
};

export type Link = {
  label: string;
  url: string;
};

export type RecipeType = {
  id: string;
  name: string;
  color: string;
};

export type RecipeAuthor = {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  isAdmin: boolean;
  isRecommended: boolean;
};

export type RecipeComment = {
  id: string;
  text: string;
  createdAt: string;
  isRecipeOwner: boolean;
  author: RecipeAuthor;
};

export type RecipeListItem = {
  id: string;
  title: string;
  shortDescription: string;
  ingredients: string[];
  preparationTime: string;
  servings: string;
  matchedGroceries?: number;
  averageRating: number;
  ratingsCount: number;
  types: RecipeType[];
  postedByRecommendedUser: boolean;
  currentUserRating?: number;
  author: RecipeAuthor;
};

export type RecipeDetails = RecipeListItem & {
  description: string;
  steps: string[];
  createdBy: string;
  currentUserRating: number | null;
  comments: RecipeComment[];
  media?: Media[];
  links?: Link[];
};

export type RecipeSort = 'newest' | 'rating' | 'quickest';

export type RecipeBrowseFilters = {
  query?: string;
  groceries?: string;
  typeIds?: string[];
  minRating?: number;
  maxPreparationMinutes?: number;
  recommendedOnly?: boolean;
  page?: number;
  limit?: number;
  sort?: RecipeSort;
};

export type RecipeBrowseResponse = {
  items: RecipeListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasMore: boolean;
};
