
export type EatingStyle = 'purees' | 'finger-foods' | 'mixed';
export type CookingSituation = 'surviving' | 'batching' | 'mixed';

export interface UserPreferences {
  age: string;
  eatingStyle: EatingStyle;
  favorites: string;
  wantsMoreOf: string;
  allergies: string;
  hatesGags: string;
  cookingSituation: CookingSituation;
  dietaryPreferences: string;
}

export interface Meal {
  title: string;
  prepNotes: string;
}

export interface DailyPlan {
  day: number;
  breakfast: Meal;
  lunch: Meal;
  dinner: Meal;
  snack?: Meal;
}

export interface WeeklyData {
  week: number;
  groceryList: string[];
  batchPrepTips: string[];
}

export interface FullMealPlan {
  days: DailyPlan[];
  weeks: WeeklyData[];
}
