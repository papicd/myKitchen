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
