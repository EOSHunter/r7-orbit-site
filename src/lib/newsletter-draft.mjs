// Pure part of scripts/newsletter-draft.mjs: reads a newsletter issue (newsletter/issues/<date>.md, Mercury's file) and says
// whether it may go to Buttondown (sent, or as a draft), and with what. No network, no file system, so it is unit-tested
// (src/lib/newsletter-draft.vitest.ts).
import { parse } from 'yaml';

/**
 * The issue's front matter and body. The body is everything after the front matter, trimmed: it is the email, in Markdown.
 * @param {string} text the file's contents
 */
export function parseIssue(text) {
  const match = (text.charCodeAt(0) === 0xfeff ? text.slice(1) : text).match(
    /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/,
  );
  if (!match) return { data: {}, body: text.trim() };
  return { data: parse(match[1]) ?? {}, body: match[2].trim() };
}

/**
 * Why the issue may not go to Buttondown yet. Empty when it may. Only an issue Parallax passed and the routine marked ready,
 * with a real subject and a body that is not the template's, is sent (or drafted).
 * @param {{ data: Record<string, unknown>, body: string }} issue
 */
export function issueProblems({ data, body }) {
  const problems = [];
  const subject = String(data.subject ?? '').trim();
  if (!subject) problems.push('the subject is empty');
  if (subject.length > 120) problems.push('the subject is longer than 120 characters');
  if (String(data.status ?? '').trim() !== 'ready') problems.push(`status is "${data.status ?? ''}", not "ready"`);
  if (!/^pass\b/i.test(String(data.parallax ?? '').trim()))
    problems.push(`parallax is "${data.parallax ?? ''}", not a pass`);
  if (!body) problems.push('the body is empty');
  if (/One sentence from the item's summary|Two or three sentences, as Mercury/.test(body))
    problems.push("the body still holds the template's placeholder lines");
  if (/<id>/.test(body)) problems.push('a link still has the template placeholder <id>');
  return problems;
}

/**
 * The Buttondown email for the issue, as a draft. `description` is the preview line after the subject.
 * @param {{ data: Record<string, unknown>, body: string }} issue
 */
export function draftPayload({ data, body }) {
  const payload = { subject: String(data.subject).trim(), body, status: 'draft' };
  const preview = String(data.preview ?? '').trim();
  if (preview) payload.description = preview;
  return payload;
}

/**
 * The Buttondown email for the issue, sent to every subscriber as soon as Buttondown takes it (`about_to_send`). Only call it
 * for an issue with no `issueProblems`: the weekly routine sends without a person reading it first (Hunter's call, 2026-11-16).
 * @param {{ data: Record<string, unknown>, body: string }} issue
 */
export function sendPayload(issue) {
  return { ...draftPayload(issue), status: 'about_to_send' };
}

/**
 * Whether Buttondown already has an email with this subject (so a second push or a rerun of the same issue never sends it twice or makes a second draft).
 * @param {{ subject?: string }[]} emails the `results` of GET /v1/emails
 * @param {string} subject
 */
export function alreadyThere(emails, subject) {
  const want = subject.trim().toLowerCase();
  return emails.some(
    (email) =>
      String(email.subject ?? '')
        .trim()
        .toLowerCase() === want,
  );
}
