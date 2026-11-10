// The newsletter (docs/NEWSLETTER.md): one email a week, written by Mercury and sent by Buttondown. Pure (no Astro, no file
// system), so it runs in the build, in the /admin bundle and under Vitest.
//
// The site never stores an address and sends no email itself. The sign-up form is a plain HTML form that posts the address to
// Buttondown's public embed endpoint; nothing loads from Buttondown until a reader presses the button (CLAUDE.md, "No
// third-party requests on page load"). Buttondown then shows its own "check your inbox" page and sends the confirmation email
// (double opt-in), the unsubscribe link and the archive.
//
// Off until the author turns it on: while `enabled` is off or `username` is empty, no form is drawn, /newsletter/ is not built
// (the 404 page), the footer has no Newsletter link and the Privacy page says it is not connected.
import { z } from 'astro/zod';

/** The service that holds the list and sends the emails, as the Privacy page names it. */
export const NEWSLETTER_PROVIDER = 'Buttondown';

/** The page about the newsletter, with the big form. */
export const NEWSLETTER_PATH = '/newsletter/';

/** A Buttondown username: the part after buttondown.com/ in the newsletter's own address (letters, digits, - and _). */
export const USERNAME_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

const words = (max: number) =>
  z.string().trim().min(1, 'is required').max(max, `is too long: ${max} characters at most`);

export const newsletterSchema = z
  .object({
    enabled: z.boolean().default(false),
    username: z
      .string()
      .trim()
      .refine((name) => name === '' || USERNAME_PATTERN.test(name), {
        message:
          "leave it empty, or paste your Buttondown username: the part after buttondown.com/ in your newsletter's address (letters, digits, - and _)",
      }),
    heading: words(80),
    text: words(300),
    buttonLabel: words(40),
    emailLabel: words(40),
  })
  .strict();

export type NewsletterSettings = z.infer<typeof newsletterSchema>;

export interface NewsletterState {
  /** Forms, the page and the footer link are drawn. */
  show: boolean;
  /** Where the form posts (Buttondown's embed endpoint for this newsletter). Empty while off. */
  action: string;
  /** The newsletter's past issues, on Buttondown. Empty while off. */
  archive: string;
}

/** Whether the newsletter is on, and its addresses. Both "Enabled" and a username are needed. */
export function newsletterState(
  settings: Pick<NewsletterSettings, 'enabled' | 'username'> | undefined,
): NewsletterState {
  const username = settings?.username?.trim() ?? '';
  if (!settings?.enabled || !USERNAME_PATTERN.test(username)) return { show: false, action: '', archive: '' };
  const name = encodeURIComponent(username);
  return {
    show: true,
    action: `https://buttondown.com/api/emails/embed-subscribe/${name}`,
    archive: `https://buttondown.com/${name}/archive/`,
  };
}

/** "Enabled" ticked with no username builds a site with no form: the message the build log and the admin show. */
export const NEWSLETTER_USERNAME_MISSING =
  'Newsletter is ticked "Enabled" but has no Buttondown username, so no sign-up form is shown. Paste the username, or untick Enabled.';

export function newsletterUsernameMissing(
  settings: Pick<NewsletterSettings, 'enabled' | 'username'> | undefined,
): boolean {
  return Boolean(settings?.enabled) && !(settings?.username ?? '').trim();
}
