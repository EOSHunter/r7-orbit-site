// The alt text box of a picture field (cover, featured image): Decap's string control, required exactly when its picture is set.
// Decap can only make a field always required or always optional, and marks an optional one "(optional)" next to its label. Alt
// text is needed whenever there is a picture (the build stops on a picture without it, src/lib/front-matter.ts), so the box said
// "optional" and the save then failed (2026-11-06). Now the field names its picture (`image: 'featuredImage'`), this control checks
// it when Save is pressed (Decap calls `isValid` before writing anything and shows the message under the box), and the admin page
// hides the "(optional)" of these boxes (src/pages/admin/index.astro).
import { Component, createElement as h, type ComponentType } from 'react';
import { isBlank } from '../lib/front-matter';

interface Props {
  value?: unknown;
  /** The field's config (Immutable): `image` names the picture field this text describes, `label` its own label. */
  field?: { get(key: string): unknown };
  /** The entry being edited (Immutable). Decap passes it to every control. */
  entry?: { getIn(path: string[]): unknown };
}

/** The message when a picture is set and its alt text is empty, or undefined when all is well. */
export function imageAltError(image: unknown, alt: unknown, label: string): { type: 'CUSTOM'; message: string } | undefined {
  if (isBlank(image ?? null)) return undefined;
  if (typeof alt === 'string' && alt.trim()) return undefined;
  return { type: 'CUSTOM', message: `${label}: describe the ${label.replace(/ alt text$/i, '').toLowerCase()} in one plain sentence. It is needed whenever there is an image.` };
}

export function withImageAltCheck<P extends Props>(Control: ComponentType<P>): ComponentType<P> {
  // A class, not a function: Decap reads `isValid` from the instance its ref gets.
  class ImageAltControl extends Component<P> {
    static displayName = `ImageAlt(${Control.displayName ?? Control.name ?? 'StringControl'})`;

    isValid() {
      const image = String(this.props.field?.get('image') ?? '');
      const label = String(this.props.field?.get('label') ?? 'Alt text');
      const error = image ? imageAltError(this.props.entry?.getIn(['data', image]), this.props.value, label) : undefined;
      return error ? { error } : true;
    }

    render() {
      return h(Control, this.props);
    }
  }
  return ImageAltControl;
}
