import { footerLinks, type FooterLink, type NavItem } from '../lib/site-settings';
import { site } from './site';
import { newsletterSettings } from '../lib/newsletter-queries';

export type { FooterLink, NavItem };

/** The header nav, in order: each item's label and address come from site.json `nav` (Site settings in /admin). */
export const navItems: NavItem[] = site.nav;

/** The footer links, in order (see `footerLinks`). */
export const footerItems: FooterLink[] = footerLinks({ ...site, newsletter: newsletterSettings });
