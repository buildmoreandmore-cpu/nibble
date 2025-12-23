import { UserPreferences, FullMealPlan, Meal } from "../types";

export const generateMealPlan = async (prefs: UserPreferences): Promise<FullMealPlan> => {
  const response = await fetch('/api/generate-plan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(prefs),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to generate meal plan. Please try again.');
  }

  return response.json();
};

export const getMealAlternatives = async (
  prefs: UserPreferences,
  mealType: string,
  currentMeal: Meal,
  existingTitles: string[]
): Promise<Meal[]> => {
  const response = await fetch('/api/get-alternatives', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prefs, mealType, currentMeal, existingTitles }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to get alternatives. Please try again.');
  }

  return response.json();
};
