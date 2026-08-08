export type Categoria = {
  id: number;
  key: string;
  name: string;
  emoji: string;
  sort: number;
};

export type Ingrediente = {
  id: number;
  key: string;
  categoryId: number;
  name: string;
  notes: string | null;
  emoji: string | null;
  imagePath: string | null;
  kcal100: number;
  protein100: number;
  carbs100: number;
  fat100: number;
  fiber100: number | null;
  archivedAt: string | null;
  createdAt: string;
  category: Categoria;
};
