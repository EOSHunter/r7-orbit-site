// The pages and public files of this checkout, listed when /admin is bundled (siteFilesModule in astro.config.mjs), so the Site
// settings editor can say a nav or footer link goes nowhere before it saves, as the build would (siteLinkProblems).
declare module 'virtual:site-files' {
  const files: import('./lib/site-settings').SiteFiles;
  export default files;
}
