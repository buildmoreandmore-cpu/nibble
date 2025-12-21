import { Redis } from '@upstash/redis';

export const config = {
  runtime: 'edge',
};

const redis = new Redis({
  url: process.env.STORAGE_URL || process.env.KV_REST_API_URL || '',
  token: process.env.STORAGE_TOKEN || process.env.KV_REST_API_TOKEN || '',
});

export default async function handler(request: Request) {
  if (request.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    // Get all emails from the list
    const emails = await redis.lrange('email_list', 0, -1);

    return new Response(JSON.stringify({
      count: emails.length,
      emails: emails.map(e => typeof e === 'string' ? JSON.parse(e) : e)
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error fetching emails:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch emails' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
