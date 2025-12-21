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

    // Save email with timestamp
    const timestamp = new Date().toISOString();
    await redis.hset('emails', { [email]: timestamp });

    // Also add to a list for easy retrieval
    await redis.lpush('email_list', JSON.stringify({ email, timestamp }));

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error saving email:', error);
    return new Response(JSON.stringify({ error: 'Failed to save email' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
