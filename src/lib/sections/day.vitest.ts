import { describe, expect, it } from 'vitest';
import { sectionsSchema } from './index';

// The editor writes `date: 2026-11-04` unquoted, and YAML reads that as a Date: the post block must still take it (Nov 9, 2026,
// a Social post block with a date failed "Date is required").
describe('a day field (the post block\'s dates)', () => {
  const post = { type: 'post', text: 'Words.', name: 'Someone', platform: 'X' };

  it('reads a date YAML parsed as a Date back as 2026-11-04', () => {
    const parsed = sectionsSchema.parse([{ ...post, date: new Date('2026-11-04T00:00:00Z'), quotedDate: new Date('2026-10-30T00:00:00Z') }]);
    expect(parsed[0]).toMatchObject({ date: '2026-11-04', quotedDate: '2026-10-30' });
  });

  it('takes the text form, leaves an empty one out, and refuses another form', () => {
    expect(sectionsSchema.parse([{ ...post, date: '2026-11-04' }])[0]).toMatchObject({ date: '2026-11-04' });
    expect(sectionsSchema.parse([post])[0]).not.toHaveProperty('date');
    expect(sectionsSchema.safeParse([{ ...post, date: '11/04/2026' }]).success).toBe(false);
  });
});
