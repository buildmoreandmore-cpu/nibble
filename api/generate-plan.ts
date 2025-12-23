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

    // Generate a 7-day meal template plus 4 weeks of grocery lists
    const prompt = `
      Create a 7-day meal plan template for a ${prefs.age} child, plus grocery lists and prep tips for 4 weeks.

      Child Details:
      - Eating Style: ${prefs.eatingStyle}
      - Favorites: ${prefs.favorites}
      - ALLERGIES: ${prefs.allergies}
      - Dislikes: ${prefs.hatesGags}
      - Cooking: ${prefs.cookingSituation}

      Rules:
      1. Create 7 unique days of meals (these will be rotated across 4 weeks).
      2. No repeated main meals within the 7 days.
      3. Age-appropriate textures.
      4. Brief prep notes for each meal.
      5. Create 4 weeks of grocery lists (15-20 items each) - vary items slightly each week.
      6. Include 4-5 practical batch prep tips for each of the 4 weeks.
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

    const basePlan = JSON.parse(jsonStr);

    // Expand 7-day template to full 28 days (4 weeks)
    const expandedDays = [];
    for (let week = 0; week < 4; week++) {
      for (let i = 0; i < 7; i++) {
        const templateDay = basePlan.days[i % basePlan.days.length];
        expandedDays.push({
          ...templateDay,
          day: week * 7 + i + 1,
          // Deep clone meals to avoid reference issues
          breakfast: { ...templateDay.breakfast },
          lunch: { ...templateDay.lunch },
          dinner: { ...templateDay.dinner },
          snack: { ...templateDay.snack }
        });
      }
    }

    // Ensure we have 4 weeks of grocery/prep data
    const weeks = basePlan.weeks || [];
    while (weeks.length < 4) {
      const templateWeek = weeks[weeks.length - 1] || weeks[0] || {
        groceryList: [],
        batchPrepTips: []
      };
      weeks.push({
        week: weeks.length + 1,
        groceryList: [...templateWeek.groceryList],
        batchPrepTips: [...templateWeek.batchPrepTips]
      });
    }

    const fullPlan = {
      days: expandedDays,
      weeks: weeks.slice(0, 4).map((w: any, idx: number) => ({ ...w, week: idx + 1 }))
    };

    return new Response(JSON.stringify(fullPlan), {
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
