import { evaluateScheduledAlerts } from './_shared/app.js';

export default async (request) => {
  let nextRun = null;
  try {
    const body = await request.json();
    nextRun = body.next_run || null;
  } catch {
    nextRun = null;
  }

  const premium = await evaluateScheduledAlerts({ plan: 'premium' });
  const runPro = new Date().getUTCHours() % 6 === 0;
  const pro = runPro ? await evaluateScheduledAlerts({ plan: 'pro' }) : { plan: 'pro', skipped: true };

  return new Response(JSON.stringify({ premium, pro, nextRun }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

export const config = { schedule: '0 * * * *' };
