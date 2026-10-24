// The built address of the runner's lazy chunk, or null in `astro dev` (the runnerChunkUrl plugin in astro.config.mjs).
declare module 'virtual:runner-chunk-url' {
  const url: string | null;
  export default url;
}
