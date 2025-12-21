import { Redis } from '@upstash/redis';

export const config = {
  runtime: 'edge',
};

const redis = new Redis({
  url: process.env.STORAGE_URL || process.env.KV_REST_API_URL || '',
  token: process.env.STORAGE_TOKEN || process.env.KV_REST_API_TOKEN || '',
});

export default async function handler(request: Request) {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const { email } = await request.json();

    if (!email) {
      return new Response(JSON.stringify({ error: 'Email required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Fetch stored plan by email
    const data = await redis.get(`plan:${email}`);

    if (!data) {
      return new Response(JSON.stringify({ exists: false }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Parse if string, otherwise use as-is
    const parsed = typeof data === 'string' ? JSON.parse(data) : data;

    return new Response(JSON.stringify({
      exists: true,
      mealPlan: parsed.mealPlan,
      prefs: parsed.prefs,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error fetching plan:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch plan' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
