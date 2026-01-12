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
    const { email, mealPlan, prefs } = await request.json();

    if (!email) {
      return new Response(JSON.stringify({ error: 'Email required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Upsert user plan (insert or update if email exists)
    const { error } = await supabase
      .from('user_plans')
      .upsert({
        email,
        meal_plan: mealPlan,
        preferences: prefs,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'email'
      });

    if (error) {
      console.error('Supabase error:', error);
      return new Response(JSON.stringify({ error: 'Failed to save plan' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

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
