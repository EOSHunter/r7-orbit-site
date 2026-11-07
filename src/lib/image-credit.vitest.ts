import { describe, expect, it } from 'vitest';
import { imageProblems } from '../admin/image-rules';
import { agentMissing, imageCredit, imageCreditHref, imageCreditName } from './image-credit';

describe('imageCredit', () => {
  it('credits the site’s owner by default', () => {
    expect(imageCredit({}, 'Hunter Newton')).toBe('Image by Hunter Newton');
    expect(imageCredit({ featuredImageBy: 'me', featuredImageAgent: 'Ignored' }, 'Hunter Newton')).toBe('Image by Hunter Newton');
  });

  it('credits the named agent when an agent made the image', () => {
    expect(imageCredit({ featuredImageBy: 'agent', featuredImageAgent: '  Orbit Agent ' }, 'Hunter Newton')).toBe('Image by Orbit Agent');
  });

  it('falls back to the owner when the agent has no name', () => {
    expect(imageCredit({ featuredImageBy: 'agent', featuredImageAgent: ' ' }, 'Hunter Newton')).toBe('Image by Hunter Newton');
  });
});

describe('agentMissing', () => {
  it('is true only for an agent credit with no name', () => {
    expect(agentMissing({ featuredImageBy: 'agent' })).toBe(true);
    expect(agentMissing({ featuredImageBy: 'agent', featuredImageAgent: '' })).toBe(true);
    expect(agentMissing({ featuredImageBy: 'agent', featuredImageAgent: 'Orbit Agent' })).toBe(false);
    expect(agentMissing({ featuredImageBy: 'me' })).toBe(false);
    expect(agentMissing({})).toBe(false);
  });
});

describe('the editor’s save check', () => {
  const post = { title: 'T', featuredImage: '../../assets/blog/a.jpg', featuredImageAlt: 'A ring' };

  it('stops a featured image credited to an agent with no name', () => {
    expect(imageProblems({ ...post, featuredImageBy: 'agent', featuredImageAgent: '' })).toEqual([
      '"T": the featured image is credited to an agent, but no agent is named. Fill in "Agent that made the featured image", or choose "Me".',
    ]);
  });

  it('lets a named agent, "me", or a post with no featured image through', () => {
    expect(imageProblems({ ...post, featuredImageBy: 'agent', featuredImageAgent: 'Orbit Agent' })).toEqual([]);
    expect(imageProblems({ ...post, featuredImageBy: 'me' })).toEqual([]);
    expect(imageProblems({ title: 'T', featuredImageBy: 'agent' })).toEqual([]);
  });
});

describe('where the credit links (2026-11-07)', () => {
  const agents = [{ name: 'Pictor', path: '/authors/pictor/' }, { name: 'Orion', path: '/authors/orion/' }];
  it("links an agent's name to its author page, and the owner to About", () => {
    expect(imageCreditName({ featuredImageBy: 'agent', featuredImageAgent: ' Pictor ' }, 'Hunter Newton')).toBe('Pictor');
    expect(imageCreditHref({ featuredImageBy: 'agent', featuredImageAgent: 'Pictor' }, 'Hunter Newton', agents)).toBe('/authors/pictor/');
    expect(imageCreditHref({ featuredImageBy: 'me' }, 'Hunter Newton', agents)).toBe('/about/');
    expect(imageCreditHref({}, 'Hunter Newton', agents)).toBe('/about/');
  });
  it('falls back to About for an agent with no author page', () => {
    expect(imageCreditHref({ featuredImageBy: 'agent', featuredImageAgent: 'Someone New' }, 'Hunter Newton', agents)).toBe('/about/');
  });
});
