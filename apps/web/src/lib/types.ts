export type User = {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  isAdmin: boolean;
  isRecommended: boolean;
  avatarUrl?: string | null;
};

export type AdminUser = User & {
  recipeCount: number;
  followingCount?: number;
  followersCount?: number;
  isFollowing?: boolean;
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
  avatarUrl?: string | null;
};

export type RecipeCollection = {
  id: string;
  name: string;
  recipeIds: string[];
};

export type ActivityFeedItem = {
  id: string;
  type: 'recipe_created' | 'recipe_rated' | 'recipe_commented';
  createdAt: string;
  actor: RecipeAuthor;
  recipe: {
    id: string;
    title: string;
  };
  ratingValue?: number;
  commentText?: string;
};

export type UserNotification = {
  id: string;
  type:
    | 'comment'
    | 'followed_author_post'
    | 'follow'
    | 'recipe_rated'
    | 'recipe_saved'
    | 'saved_recipe_updated';
  createdAt: string;
  isRead: boolean;
  actor: RecipeAuthor;
  recipe?: {
    id: string;
    title: string;
  };
  commentText?: string;
  ratingValue?: number;
};

export type NotificationsResponse = {
  items: UserNotification[];
  unreadCount: number;
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
