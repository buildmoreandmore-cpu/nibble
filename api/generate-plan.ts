import { GoogleGenAI, Type } from "@google/genai";

export const config = {
  runtime: 'edge',
};

export default async function handler(request: Request) {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const prefs = await request.json();

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'API key not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const ai = new GoogleGenAI({ apiKey });

    const prompt = `
      Create a 7-day meal plan for a ${prefs.age} child.

      Child Details:
      - Eating Style: ${prefs.eatingStyle}
      - Favorites: ${prefs.favorites}
      - ALLERGIES: ${prefs.allergies}
      - Dislikes: ${prefs.hatesGags}
      - Cooking: ${prefs.cookingSituation}

      Rules:
      1. 7 days total (day 1-7).
      2. No repeated main meals.
      3. Age-appropriate textures.
      4. Brief prep notes.
      5. Grocery list should have 15-20 items covering all meals.
      6. Include 4-5 practical batch prep tips for the week.
    `;

    const mealSchema = {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING },
        prepNotes: { type: Type.STRING }
      },
      required: ["title", "prepNotes"]
    };

    const daySchema = {
      type: Type.OBJECT,
      properties: {
        day: { type: Type.NUMBER },
        breakfast: mealSchema,
        lunch: mealSchema,
        dinner: mealSchema,
        snack: mealSchema
      },
      required: ["day", "breakfast", "lunch", "dinner", "snack"]
    };

    const weekSchema = {
      type: Type.OBJECT,
      properties: {
        week: { type: Type.NUMBER },
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
    };

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            days: {
              type: Type.ARRAY,
              items: daySchema
            },
            weeks: {
              type: Type.ARRAY,
              items: weekSchema
            }
          },
          required: ["days", "weeks"]
        }
      }
    });

    const jsonStr = response.text || '';

    if (!jsonStr || jsonStr.trim() === '') {
      return new Response(JSON.stringify({ error: 'Empty response from AI' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const mealPlan = JSON.parse(jsonStr);

    return new Response(JSON.stringify(mealPlan), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error generating meal plan:', error);
    return new Response(JSON.stringify({ error: error?.message || 'Failed to generate meal plan' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
