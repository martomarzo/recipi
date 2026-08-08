export interface ParsedIngredient {
  quantity: string | null;
  unit: string | null;
  name: string;
}

export interface ParsedStep {
  position: number;
  text: string;
}

export interface ParsedRecipe {
  name: string;
  description: string;
  ingredients: ParsedIngredient[];
  steps: ParsedStep[];
}

export interface RecipeWithDetails {
  id: string;
  name: string;
  description: string | null;
  rawText: string;
  imageUrl: string | null;
  createdAt: string;
  updatedAt: string;
  ingredients: {
    id: number;
    position: number;
    quantity: string | null;
    unit: string | null;
    name: string;
  }[];
  steps: {
    id: number;
    position: number;
    text: string;
  }[];
  avgRating: number | null;
  ratingCount: number;
}

export interface RecipeListItem {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  avgRating: number | null;
  ratingCount: number;
  createdAt: string;
}
