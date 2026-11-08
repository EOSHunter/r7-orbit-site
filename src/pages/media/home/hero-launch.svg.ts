// /media/home/hero-launch.svg: the home page hero's moving layer (src/lib/hero-launch.ts), built once with the sprites from
// src/assets/home/sprites/ embedded and the brass from the design tokens. hero-launch-still.svg.ts is its reduced-motion twin.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import data from '../../../data/home-hero.json';
import tokens from '../../../styles/design-system/tokens.json';
import { heroLaunchSvg, type HeroData } from '../../../lib/hero-launch';

export function sprites() {
  const dir = join(process.cwd(), 'src', 'assets', 'home', 'sprites');
  const names = [...data.projects.map((p) => p.project), 'agent'];
  const sprites = Object.fromEntries(names.map((name) => [name, `data:image/webp;base64,${readFileSync(join(dir, `${name}.webp`)).toString('base64')}`]));
  return sprites;
}

export const svgResponse = (still: boolean) =>
  new Response(heroLaunchSvg(data as HeroData, sprites(), { brass: tokens.color.brass.$value }, { still }), {
    headers: { 'Content-Type': 'image/svg+xml; charset=utf-8' },
  });

export function GET() {
  return svgResponse(false);
}
