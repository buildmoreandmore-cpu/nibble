
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
    3. Age-appropriate textures and portions based on the eating style.
    4. Simple prep notes for every meal.
    5. Weekly grocery lists for 4 weeks.
    6. Practical batch prep tips for each week based on the cooking situation.
    7. Tone: Warm, supportive, empathetic, and realistic.
  `;

  // Always use ai.models.generateContent with model and contents as single parameter
  const response = await getAI().models.generateContent({
    model: "gemini-3-flash-preview",
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
  return JSON.parse(jsonStr);
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
    Tone: Supportive and realistic.
  `;

  const response = await getAI().models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            prepNotes: { type: Type.STRING }
          },
          required: ["title", "prepNotes"]
        }
      }
    }
  });

  // Extract text using the .text property (do not use .text())
  const jsonStr = response.text || '';
  return JSON.parse(jsonStr);
};
