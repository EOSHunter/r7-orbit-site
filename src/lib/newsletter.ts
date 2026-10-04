/**
 * Newsletter sign-up, in the browser.
 *
 * One setting decides where the form goes: `newsletter.formAction` in src/data/site.json.
 *   ""          -> the mock below. Nothing leaves the page, no network request is made.
 *   "https://…" -> the form is POSTed there (FormData, field `email`). With JavaScript off the browser posts the same
 *                  form natively, so the provider's own thank-you page takes over.
 * Nothing else needs to change to swap the mock for a real service.
 */

export type SubscribeResult = { ok: true } | { ok: false; reason: 'invalid' | 'failed' };

export const MESSAGES = {
  invalid: "That doesn't look like an email address.",
  failed: "That didn't go through. Check the address and try again.",
  ok: "You're on the list. Check your email to confirm.",
  // Shown instead of `ok` while the mock is in use, so nobody is told an email is on its way when it is not.
  okMock: "You're on the list. (Sample only: the newsletter isn't connected yet, so nothing was sent.)",
} as const;

export function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

/**
 * Stand-in for a real endpoint. Answers after a short wait, like a network would.
 * To see the error state, use an address that starts with "fail" or "error" (for example fail@example.com).
 */
export async function mockSubscribe(email: string): Promise<SubscribeResult> {
  await new Promise((resolve) => setTimeout(resolve, 600));
  if (/^(fail|error)/i.test(email.trim())) return { ok: false, reason: 'failed' };
  return { ok: true };
}

async function postSubscribe(endpoint: string, data: FormData): Promise<SubscribeResult> {
  try {
    const response = await fetch(endpoint, { method: 'POST', body: data, headers: { Accept: 'application/json' } });
    return response.ok ? { ok: true } : { ok: false, reason: 'failed' };
  } catch {
    return { ok: false, reason: 'failed' };
  }
}

/** `endpoint` empty means the mock. */
export async function subscribe(endpoint: string, data: FormData): Promise<SubscribeResult> {
  const email = String(data.get('email') ?? '');
  if (!isEmail(email)) return { ok: false, reason: 'invalid' };
  return endpoint ? postSubscribe(endpoint, data) : mockSubscribe(email);
}
