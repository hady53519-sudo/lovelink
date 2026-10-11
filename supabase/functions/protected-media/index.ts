// Supabase Edge Function: protected-media
// Verifies a page password server-side (via get_public_surprise, which also
// throttles brute force) and, only on success, returns short-lived signed URLs
// for that page's private photos. The service-role key stays in the function's
// environment and never reaches the browser.
//
// Deploy:  supabase functions deploy protected-media
// (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically.)

// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const BUCKET = 'surprise-media';
const ALLOWED_ORIGIN = Deno.env.get('ALLOWED_ORIGIN') ?? '*'; // set to your site origin in production

const cors = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  let slug = '';
  let password = '';
  try {
    const body = await req.json();
    slug = String(body.slug ?? '').slice(0, 64);
    password = String(body.password ?? '').slice(0, 72);
  } catch {
    return json({ error: 'bad_request' }, 400);
  }
  if (!slug || !password) return json({ error: 'bad_request' }, 400);

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );

  const { data, error } = await admin.rpc('get_public_surprise', {
    p_slug: slug,
    p_password: password,
  });
  if (error || !data) return json({ error: 'server_error' }, 500);
  if (data.status !== 'ok') return json({ status: data.status }, 200);

  const paths: string[] = (data.surprise.photos ?? []).map((p: any) => p.path);
  if (paths.length === 0) return json({ status: 'ok', urls: {} });

  const { data: signed, error: signError } = await admin.storage
    .from(BUCKET)
    .createSignedUrls(paths, 3600);
  if (signError) return json({ error: 'sign_failed' }, 500);

  const urls: Record<string, string> = {};
  for (const item of signed ?? []) {
    if (item.path && item.signedUrl) urls[item.path] = item.signedUrl;
  }
  return json({ status: 'ok', urls });
});
