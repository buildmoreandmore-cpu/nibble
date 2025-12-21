
import { GoogleGenAI, Type } from "@google/genai";
import { UserPreferences, FullMealPlan, Meal } from "../types";

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
    Create a 30-day meal plan for a ${prefs.age} child.

    Eating Style: ${prefs.eatingStyle}
    Favorites: ${prefs.favorites || 'none'}
    ALLERGIES (AVOID): ${prefs.allergies || 'none'}
    Dislikes: ${prefs.hatesGags || 'none'}
    Cooking: ${prefs.cookingSituation}

    Rules:
    1. 30 days: Breakfast, Lunch, Dinner, Snack each day.
    2. NO REPEATS for main meals.
    3. Age-appropriate textures (purees for 6-9mo, soft foods for 1yr+, table food for 2yr+).
    4. BRIEF prep notes (1 short sentence max, under 50 characters).
    5. 4 weekly grocery lists (10 key items max each).
    6. 2 batch prep tips per week max.
  `;

  // Always use ai.models.generateContent with model and contents as single parameter
  const response = await getAI().models.generateContent({
    model: "gemini-2.0-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          days: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                day: { type: Type.INTEGER },
                breakfast: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    prepNotes: { type: Type.STRING }
                  },
                  required: ["title", "prepNotes"]
                },
                lunch: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    prepNotes: { type: Type.STRING }
                  },
                  required: ["title", "prepNotes"]
                },
                dinner: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    prepNotes: { type: Type.STRING }
                  },
                  required: ["title", "prepNotes"]
                },
                snack: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    prepNotes: { type: Type.STRING }
                  },
                  required: ["title", "prepNotes"]
                }
              },
              required: ["day", "breakfast", "lunch", "dinner", "snack"]
            }
          },
          weeks: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                week: { type: Type.INTEGER },
                groceryList: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING }
                },
                batchPrepTips: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING }
                }
              },
              required: ["week", "groceryList", "batchPrepTips"]
            }
          }
        },
        required: ["days", "weeks"]
      }
    }
  });

  // Extract text using the .text property (do not use .text())
  const jsonStr = response.text || '';

  if (!jsonStr || jsonStr.trim() === '') {
    throw new Error('Empty response from AI. Please try again.');
  }

  try {
    return JSON.parse(jsonStr);
  } catch (parseError) {
    console.error('JSON Parse Error. Response length:', jsonStr.length);
    console.error('Response preview:', jsonStr.substring(0, 500));
    throw new Error('Failed to parse meal plan. The response may have been too large. Please try again.');
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
