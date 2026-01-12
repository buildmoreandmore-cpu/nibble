import { createClient } from '@supabase/supabase-js';

export const config = {
  runtime: 'edge',
};

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_ANON_KEY || ''
);

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
    const { data, error } = await supabase
      .from('user_plans')
      .select('meal_plan, preferences')
      .eq('email', email)
      .single();

    if (error || !data) {
      return new Response(JSON.stringify({ exists: false }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      exists: true,
      mealPlan: data.meal_plan,
      prefs: data.preferences,
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
