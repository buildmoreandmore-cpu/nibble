
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
    You are a supportive meal planning assistant for busy parents. Create a 30-day meal plan for a child.

    Child Details:
    - Age: ${prefs.age}
    - Eating Style: ${prefs.eatingStyle}
    - Favorite Foods (Sprinkle in sparingly): ${prefs.favorites}
    - Include more of: ${prefs.wantsMoreOf}
    - ALLERGIES (STRICT NO): ${prefs.allergies}
    - Avoid (Hate/Gag/Not ready): ${prefs.hatesGags}
    - Cooking Situation: ${prefs.cookingSituation}
    - Dietary Preferences: ${prefs.dietaryPreferences}

    Rules:
    1. 30 days of Breakfast, Lunch, and Dinner (plus a snack).
    2. NO REPEATS for main meals (Breakfast/Lunch/Dinner).
    3. CRITICAL - Match textures to age AND eating style:
       - 6-9 months with purees: smooth purees only
       - 9-12 months: soft mashed foods, small soft pieces
       - 1 year+: soft table foods, small bite-sized pieces
       - 18 months+: regular table food textures, cut appropriately
       - 2+ years: family-style meals with age-appropriate cuts
       - If eating style is "table-food" or "finger-foods", DO NOT suggest purees regardless of age (exception: naturally pureed foods like mashed potatoes, hummus, yogurt)
    4. Simple prep notes for every meal.
    5. Weekly grocery lists for 4 weeks.
    6. Practical batch prep tips for each week based on the cooking situation.
    7. Tone: Warm, supportive, empathetic, and realistic.
  `;

  // Always use ai.models.generateContent with model and contents as single parameter
  const response = await getAI().models.generateContent({
    model: "gemini-1.5-flash",
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
