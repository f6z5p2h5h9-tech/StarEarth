// Vercel Serverless Function: Supabase Heartbeat
// Keeps the Supabase free tier database from pausing by running query on users table
// Scheduled using vercel.json cron configuration

export default async function handler(req, res) {
  const SUPABASE_URL = 'https://hyqdeepnodhjytyhdrcu.supabase.co';
  const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh5cWRlZXBub2Roanl0eWhkcmN1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczMzk0NzAsImV4cCI6MjA5MjkxNTQ3MH0.jZoA9rgbSbCEb0N3Wqu7hMW-nMydnWDK2Ir_IfNw9dY';

  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/users?select=count`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
      },
    });
    const data = await response.json();
    console.log(`💓 Heartbeat OK — ${new Date().toISOString()} — users count: ${JSON.stringify(data)}`);
    return res.status(200).json({ success: true, count: data });
  } catch (err) {
    console.error('💔 Heartbeat failed:', err.message);
    return res.status(500).json({ error: err.message || 'Heartbeat failed' });
  }
}
