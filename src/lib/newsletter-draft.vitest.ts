import { describe, expect, it } from 'vitest';
import { alreadyThere, draftPayload, issueProblems, parseIssue } from './newsletter-draft.mjs';

const issue = (
  front: string,
  body = 'I picked three items this week.\n\n## News in short\n\n- **[A](https://r7orbit.io/news/a/)** One line.',
) => `---\n${front}\n---\n\n${body}\n`;
const ready =
  'subject: "Fable 5.2 costs less"\npreview: "Plus three more news items"\ncovers: "2026-11-09 to 2026-11-15"\nstatus: ready\nparallax: "pass, 0 fixes open"';

describe('a newsletter issue becoming a Buttondown draft', () => {
  it('reads the front matter and the body', () => {
    const { data, body } = parseIssue(issue(ready));
    expect(data).toMatchObject({ subject: 'Fable 5.2 costs less', status: 'ready' });
    expect(body.startsWith('I picked three items')).toBe(true);
  });

  it('allows an issue Parallax passed and the routine marked ready', () => {
    expect(issueProblems(parseIssue(issue(ready)))).toEqual([]);
  });

  it('refuses a draft status, a failed or pending check, an empty subject, and the template left in', () => {
    expect(issueProblems(parseIssue(issue(ready.replace('status: ready', 'status: draft'))))).toEqual([
      'status is "draft", not "ready"',
    ]);
    expect(issueProblems(parseIssue(issue(ready.replace('pass, 0 fixes open', 'fail, 2 fixes open'))))).toEqual([
      'parallax is "fail, 2 fixes open", not a pass',
    ]);
    expect(issueProblems(parseIssue(issue(ready.replace('Fable 5.2 costs less', ''))))).toContain(
      'the subject is empty',
    );
    const template = issue(
      ready,
      'Two or three sentences, as Mercury: what this issue covers.\n\n- **[T](https://r7orbit.io/news/<id>/)**',
    );
    expect(issueProblems(parseIssue(template))).toEqual([
      "the body still holds the template's placeholder lines",
      'a link still has the template placeholder <id>',
    ]);
  });

  it('always asks for a draft, with the preview line as the description', () => {
    expect(draftPayload(parseIssue(issue(ready)))).toMatchObject({
      subject: 'Fable 5.2 costs less',
      status: 'draft',
      description: 'Plus three more news items',
    });
  });

  it('knows an email with the same subject is already there, whatever the case', () => {
    expect(alreadyThere([{ subject: 'fable 5.2 costs less ' }], 'Fable 5.2 costs less')).toBe(true);
    expect(alreadyThere([{ subject: 'Another week' }], 'Fable 5.2 costs less')).toBe(false);
  });
});
