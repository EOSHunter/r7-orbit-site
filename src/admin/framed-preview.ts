// The preview of the fixed-frame pages (privacy, 404, search): the About preview (about-preview.ts) drawn from the
// page's data as the reader gets it, with the settings tokens filled from src/data/site.json and only the blocks whose
// `{if newsletter …}` condition holds (src/lib/page-copy.ts, the same functions the pages use). The blocks are drawn one after
// another, as on About: the page's frame (the eyebrow, the search box, the orbit) is not, and a line
// above the preview says so. A token that does not exist is shown as typed, with the build's message above the page.
import { createElement as h } from 'react';
import type { PreviewTemplateComponentProps } from 'decap-cms-core';
import site from '../data/site.json';
import { fillPage, pageSettingsOf } from '../lib/page-copy';
import type { Section } from '../lib/sections';
import { aboutPreview, type AboutPreviewOptions } from './about-preview';

type Data = { title: string; seoTitle?: string; description: string; sections: Section[] };

export function framedPreview(name: string, options: AboutPreviewOptions) {
  const AboutPreview = aboutPreview(options);
  const settings = pageSettingsOf(site);
  return function FramedPreview(props: PreviewTemplateComponentProps) {
    const raw = (props.entry.get('data')?.toJS() ?? {}) as Record<string, unknown>;
    let data: Record<string, unknown> = raw;
    let problem = '';
    try {
      const sections = Array.isArray(raw.sections) ? (raw.sections as Section[]) : [];
      data = fillPage(
        { ...raw, title: String(raw.title ?? ''), description: String(raw.description ?? ''), sections } as Data,
        settings,
        `${name}.md`,
      );
    } catch (error) {
      problem = error instanceof Error ? error.message : String(error);
    }
    // The About preview reads only `entry.get('data').toJS()`; everything else is the real entry.
    const entry = new Proxy(props.entry, {
      get: (target, key) =>
        key === 'get' ? (k: string) => (k === 'data' ? { toJS: () => data } : target.get(k)) : Reflect.get(target, key),
    });
    return h(
      'div',
      null,
      h(
        'p',
        { className: 'admin-preview-note' },
        'This page keeps its own frame around these blocks (the eyebrow, the search box, the orbit), which the preview does not draw: the hint above the blocks says where each one sits. Site settings such as the email are filled in.',
      ),
      problem && h('p', { className: 'admin-preview-note', role: 'alert' }, `Fix before saving: ${problem}`),
      h(AboutPreview, { ...props, entry }),
    );
  };
}
