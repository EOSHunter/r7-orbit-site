// /media/home/hero-launch-still.svg: the home page hero's layer for reduced motion: every project with its agent docked, nothing
// moving (src/lib/hero-launch.ts). HeroLaunch.astro picks it with a <picture> media query.
import { svgResponse } from './hero-launch.svg';

export function GET() {
  return svgResponse(true);
}
