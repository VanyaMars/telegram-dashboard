import { createClient } from 'npm:@supabase/supabase-js@2';
import { base64url } from 'npm:jose@6.1.3';
import { createBrowserSession } from '../_shared/browser-auth.ts';

const devices = 'prodesk_browser_devices';
const deviceKeyPattern = /^[A-Za-z0-9_-]{122}$/;
const challengePattern = /^[A-Za-z0-9_-]{43}$/;
const signaturePattern = /^[A-Za-z0-9_-]{86}$/;
const uuid = /^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const encoder = new TextEncoder();
export const deviceSessionLifetime = 60 * 60;

function admin() {
  const url = Deno.env.get('SUPABASE_URL');
  const named = Deno.env.get('SUPABASE_SECRET_KEYS');
  let key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  try { if (named) key = JSON.parse(named).default || key; } catch { /* Use the legacy service-role key. */ }
  if (!url || !key) throw new Error('Browser device storage unavailable');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

const importDeviceKey = (key: string) => crypto.subtle.importKey(
  'spki', new Uint8Array(base64url.decode(key)), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']
);

export async function registerBrowserDevice(userId: number, publicKey: unknown) {
  if (typeof publicKey !== 'string' || !deviceKeyPattern.test(publicKey)) return null;
  try { await importDeviceKey(publicKey); } catch { return null; }
  const { data, error } = await admin().from(devices)
    .insert({ telegram_user_id: userId, device_key: publicKey }).select('id').single();
  if (error) throw error;
  return data.id as string;
}

type DeviceAction = 'device_challenge' | 'device_refresh' | 'device_logout';

export async function browserDeviceAction(body: Record<string, unknown>, action: DeviceAction) {
  const invalid = { status: 401, payload: { error: 'Сессия браузера завершена.' } };
  const retry = { status: 409, payload: { error: 'Запрос восстановления истёк.' } };
  const { deviceId, challenge, signature } = body;
  if (typeof deviceId !== 'string' || !uuid.test(deviceId)) return invalid;

  const db = admin();
  if (action === 'device_challenge') {
    const proposal = base64url.encode(crypto.getRandomValues(new Uint8Array(32)));
    const { data, error } = await db.rpc('prodesk_browser_device_challenge', { p_id: deviceId, p_challenge: proposal });
    if (error) throw error;
    return data ? { status: 200, payload: { ok: true, challenge: data } } : invalid;
  }

  if (typeof challenge !== 'string' || !challengePattern.test(challenge) ||
      typeof signature !== 'string' || !signaturePattern.test(signature)) return invalid;
  const { data: device, error } = await db.from(devices)
    .select('telegram_user_id, device_key, challenge, challenge_expires_at').eq('id', deviceId).maybeSingle();
  if (error) throw error;
  if (!device) return invalid;
  const id = Number(device.telegram_user_id);
  if (!Number.isSafeInteger(id) || id <= 0) return invalid;
  const key = await importDeviceKey(device.device_key);
  const message = encoder.encode(`prodesk-browser-device:${action}:${deviceId}:${challenge}`);
  const verified = await crypto.subtle.verify(
    { name: 'ECDSA', hash: 'SHA-256' }, key, new Uint8Array(base64url.decode(signature)), message
  );
  if (!verified) return invalid;
  if (device.challenge !== challenge || !(Date.parse(device.challenge_expires_at) > Date.now())) return retry;

  const allowed = Deno.env.get('TG_ALLOWED_USER_ID');
  if (action === 'device_refresh' && allowed && allowed !== String(id)) return { ...invalid, status: 403 };
  const update = action === 'device_logout' ? db.from(devices).delete() :
    db.from(devices).update({ challenge: null, challenge_expires_at: null });
  const result = await update.eq('id', deviceId).eq('challenge', challenge)
    .gt('challenge_expires_at', new Date().toISOString()).select('id').maybeSingle();
  if (result.error) throw result.error;
  if (!result.data) return retry;
  if (action === 'device_logout') return { status: 200, payload: { ok: true } };

  const session = await createBrowserSession({ id }, deviceSessionLifetime);
  return { status: 200, payload: { ok: true, session: { ...session, deviceId } } };
}
