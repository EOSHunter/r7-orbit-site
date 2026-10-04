import { site } from './site';

/** Where each label in site.json `nav` goes. The section pages arrive in phase 4 (docs/BUILD_PLAN.md). */
const HREFS: Record<string, string> = {
  Latest: '/#latest',
  News: '/news/',
  Blog: '/blog/',
  Vlogs: '/vlogs/',
  Projects: '/projects/',
  Repos: '/repos/',
  About: '/about/',
};

export interface NavItem {
  label: string;
  href: string;
}

export const navItems: NavItem[] = site.nav.map((label) => ({
  label,
  href: HREFS[label] ?? `/${label.toLowerCase()}/`,
}));
