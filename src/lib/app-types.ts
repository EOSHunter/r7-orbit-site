// The types of a playable project (a project with a `playUrl`): what the `appType` field may hold. This list is the one place
// they are defined: the projects schema (src/content.config.ts), the editor's select (src/admin/config.ts), the type filter and the
// type chip on /apps/, the card's primary button, the search result's label and the structured data all read it. Adding a type
// is one line here (docs/CONTENT_MODEL.md, "Playable projects"). No imports, so the schema, the admin bundle and Vitest can load it.
//
//   label    the type chip on a card and the search result's kind     plural  the filter button on /apps/
//   icon     an icon of the sprite (src/components/icons.ts)          action  the card's primary button
//   ld       the schema.org types of the project page                 category  its applicationCategory
export const APP_TYPES = {
  game: { label: 'Game', plural: 'Games', icon: 'play', action: 'Play', ld: ['VideoGame', 'SoftwareApplication'], category: 'Game' },
  app: { label: 'App', plural: 'Apps', icon: 'project', action: 'Open', ld: ['SoftwareApplication'], category: 'WebApplication' },
} as const;

export type AppType = keyof typeof APP_TYPES;

/** The ids, in the order of APP_TYPES: the filter's order and the editor's options. */
export const APP_TYPE_IDS = Object.keys(APP_TYPES) as [AppType, ...AppType[]];

/** A playable project without `appType` is an app. */
export const DEFAULT_APP_TYPE: AppType = 'app';

/** The type of a playable project: its `appType`, or the default. */
export function appTypeOf(data: { appType?: string }): AppType {
  return data.appType && data.appType in APP_TYPES ? (data.appType as AppType) : DEFAULT_APP_TYPE;
}
