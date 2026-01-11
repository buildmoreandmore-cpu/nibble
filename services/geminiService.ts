
import { GoogleGenAI, Type } from "@google/genai";
import { UserPreferences, FullMealPlan, Meal, FridgeMeal } from "../types";

// Lazy initialization to prevent crashes when API key is not set
let ai: GoogleGenAI | null = null;

const getAI = () => {
  if (!ai) {
    const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("API key not configured. Please set GEMINI_API_KEY environment variable.");
    }
    ai = new GoogleGenAI({ apiKey });
  }
  return ai;
};

export const generateMealPlan = async (prefs: UserPreferences): Promise<FullMealPlan> => {
  const prompt = `
    Create a 28-day (4 week) meal plan for a ${prefs.age} child.

    Child Details:
    - Eating Style: ${prefs.eatingStyle}
    - Favorites: ${prefs.favorites}
    - ALLERGIES: ${prefs.allergies}
    - Dislikes: ${prefs.hatesGags}
    - Cooking: ${prefs.cookingSituation}

    Return ONLY valid JSON in this exact format (no markdown, no explanation):
    {
      "days": [
        {
          "day": 1,
          "breakfast": {"title": "Meal name", "prepNotes": "Brief prep note"},
          "lunch": {"title": "Meal name", "prepNotes": "Brief prep note"},
          "dinner": {"title": "Meal name", "prepNotes": "Brief prep note"},
          "snack": {"title": "Snack name", "prepNotes": "Brief prep note"}
        }
      ],
      "weeks": [
        {
          "week": 1,
          "groceryList": ["item1", "item2", "...15-20 items total"],
          "batchPrepTips": ["tip1", "tip2", "...4-5 practical tips"]
        }
      ]
    }

    Rules:
    1. Generate exactly 28 days (day 1 through day 28).
    2. Generate exactly 4 weeks of grocery lists and batch prep tips (week 1, 2, 3, 4).
    3. No repeated main meals across the entire 28 days.
    4. Age-appropriate textures for ${prefs.age}.
    5. Brief prep notes for each meal.
    6. Each week's grocery list should have 15-20 items covering that week's meals.
    7. Include 4-5 practical batch prep tips per week.
    8. Week 1 covers days 1-7, Week 2 covers days 8-14, Week 3 covers days 15-21, Week 4 covers days 22-28.
  `;

  const response = await getAI().models.generateContent({
    model: "gemini-2.0-flash",
    contents: prompt
  });

  // Extract text using the .text property (do not use .text())
  let jsonStr = response.text || '';

  if (!jsonStr || jsonStr.trim() === '') {
    throw new Error('Empty response from AI. Please try again.');
  }

  // Remove markdown code blocks if present
  jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

  try {
    return JSON.parse(jsonStr);
  } catch (parseError) {
    console.error('JSON Parse Error. Response length:', jsonStr.length);
    console.error('Response preview:', jsonStr.substring(0, 500));
    throw new Error('Failed to parse meal plan. Please try again.');
  }
};

export const getMealAlternatives = async (
  prefs: UserPreferences, 
  mealType: string, 
  currentMeal: Meal,
  existingTitles: string[]
): Promise<Meal[]> => {
  const prompt = `
    Provide 3 alternative ${mealType} ideas for a child who is ${prefs.age} years old.
    Current meal being replaced: "${currentMeal.title}".
    Eating style: ${prefs.eatingStyle}.
    Cooking situation: ${prefs.cookingSituation}.

    CRITICAL: Avoid these existing meals to prevent repeats: ${existingTitles.slice(0, 50).join(", ")}.

    Ensure alternatives are safe, age-appropriate, and follow dietary preferences: ${prefs.dietaryPreferences}.
    Include prep time and cook time estimates (e.g., "5 mins", "10 mins"). Use "0 mins" for no-cook items.
    Tone: Supportive and realistic.
  `;

  const response = await getAI().models.generateContent({
    model: "gemini-1.5-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            prepNotes: { type: Type.STRING },
            prepTime: { type: Type.STRING },
            cookTime: { type: Type.STRING }
          },
          required: ["title", "prepNotes", "prepTime", "cookTime"]
        }
      }
    }
  });

  // Extract text using the .text property (do not use .text())
  const jsonStr = response.text || '';
  return JSON.parse(jsonStr);
};

export const getFridgeIdeas = async (
  ingredients: string,
  prefs: UserPreferences
): Promise<FridgeMeal[]> => {
  const prompt = `
    A parent has these ingredients in their fridge/pantry: ${ingredients}

    Their child is ${prefs.age} with eating style: ${prefs.eatingStyle}.
    ALLERGIES (must completely avoid): ${prefs.allergies || 'None'}
    Foods they dislike: ${prefs.hatesGags || 'None'}
    Cooking capacity: ${prefs.cookingSituation}
    Dietary preferences: ${prefs.dietaryPreferences || 'None'}

    Suggest 4 simple, realistic meal ideas using these ingredients.
    Consider age-appropriate textures and portion sizes.
    Keep prep notes brief and practical.
    Focus on what can actually be made with the listed ingredients.
  `;

  const response = await getAI().models.generateContent({
    model: "gemini-2.0-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            prepNotes: { type: Type.STRING },
            ingredientsUsed: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ["title", "prepNotes", "ingredientsUsed"]
        }
      }
    }
  });

  const jsonStr = response.text || '';
  return JSON.parse(jsonStr);
};
