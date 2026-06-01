// Netlify Scheduled Function: Supabase Heartbeat
// Runs every 5 days to prevent Supabase free tier from pausing
// Schedule: configured in netlify.toml

export default async (req) => {
  const SUPABASE_URL = 'https://hyqdeepnodhjytyhdrcu.supabase.co';
  const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh5cWRlZXBub2Roanl0eWhkcmN1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczMzk0NzAsImV4cCI6MjA5MjkxNTQ3MH0.jZoA9rgbSbCEb0N3Wqu7hMW-nMydnWDK2Ir_IfNw9dY';

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/users?select=count`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
      },
    });
    const data = await res.json();
    console.log(`💓 Heartbeat OK — ${new Date().toISOString()} — users count: ${JSON.stringify(data)}`);
    return new Response(`Heartbeat OK: ${JSON.stringify(data)}`, { status: 200 });
  } catch (err) {
    console.error('💔 Heartbeat failed:', err.message);
    return new Response(`Heartbeat failed: ${err.message}`, { status: 500 });
  }
};

export const config = {
  schedule: "0 6 */5 * *"  // Every 5 days at 6:00 AM UTC
};
