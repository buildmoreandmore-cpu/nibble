import { GoogleGenAI, Type } from "@google/genai";

export const config = {
  runtime: 'edge',
};

export default async function handler(request: Request) {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const { prefs, mealType, currentMeal, existingTitles } = await request.json();

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'API key not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const ai = new GoogleGenAI({ apiKey });

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

    const response = await ai.models.generateContent({
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

    const jsonStr = response.text || '';
    const alternatives = JSON.parse(jsonStr);

    return new Response(JSON.stringify(alternatives), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error getting alternatives:', error);
    return new Response(JSON.stringify({ error: error?.message || 'Failed to get alternatives' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
