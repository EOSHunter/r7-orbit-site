// Playable projects: the pure helpers behind PlayPanel, the card badge and the JSON-LD. The play address is data (the
// `playUrl` field), never written into code; public/_headers allows framing one origin, and tests/headers.spec.js checks
// that every embedded playUrl in src/content/projects/ is on it.

export type Platform = 'desktop' | 'mobile';

/** The playable fields of a project entry (docs/CONTENT_MODEL.md). */
export interface PlayFields {
  playUrl?: string;
  playMode?: 'embed' | 'link';
  playAspect?: string;
  controls?: { key: string; action: string }[];
  playNote?: string;
  platforms?: Platform[];
}

export const PLATFORM_LABEL: Record<Platform, string> = { desktop: 'Desktop', mobile: 'Mobile' };

/** A project is playable when it has a play address. */
export function isPlayable(data: Pick<PlayFields, 'playUrl'>): boolean {
  return Boolean(data.playUrl);
}

/** `16:9` -> `16 / 9`, for the CSS `aspect-ratio` property. Anything that is not width:height falls back to 16 / 9. */
export function aspectRatio(aspect: string | undefined): string {
  const m = /^([1-9]\d{0,2}):([1-9]\d{0,2})$/.exec(aspect ?? '');
  return m ? `${m[1]} / ${m[2]}` : '16 / 9';
}

/** The origin (`https://play.r7orbit.io`) of a play address: what `frame-src` in public/_headers has to list. */
export function playOrigin(playUrl: string): string {
  return new URL(playUrl).origin;
}
