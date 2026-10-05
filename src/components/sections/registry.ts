// Which Astro component draws which block. Typed `Record<SectionType, …>`, so a block in definitions.ts without a component here is a
// type error (and sections.vitest.ts also checks the file exists, named <Id>Block.astro). The component takes `{ block, ctx }`.
import type { AstroComponentFactory } from 'astro/runtime/server/index.js';
import type { SectionType } from '../../lib/sections';
import HeadingBlock from './HeadingBlock.astro';
import LeadBlock from './LeadBlock.astro';
import TextBlock from './TextBlock.astro';
import QuoteBlock from './QuoteBlock.astro';
import PullquoteBlock from './PullquoteBlock.astro';
import CalloutBlock from './CalloutBlock.astro';
import CodeBlock from './CodeBlock.astro';
import ImageBlock from './ImageBlock.astro';
import ImageRowBlock from './ImageRowBlock.astro';
import GalleryBlock from './GalleryBlock.astro';
import PortraitBlock from './PortraitBlock.astro';
import VideoBlock from './VideoBlock.astro';
import GameBlock from './GameBlock.astro';
import ColumnsBlock from './ColumnsBlock.astro';
import DividerBlock from './DividerBlock.astro';
import SpacerBlock from './SpacerBlock.astro';
import LinksBlock from './LinksBlock.astro';
import ButtonBlock from './ButtonBlock.astro';
import TocBlock from './TocBlock.astro';
import StatsBlock from './StatsBlock.astro';
import LatestBlock from './LatestBlock.astro';
import FeedBlock from './FeedBlock.astro';
import PinnedBlock from './PinnedBlock.astro';
import GamesBlock from './GamesBlock.astro';
import AuthorBlock from './AuthorBlock.astro';
import NewsletterBlock from './NewsletterBlock.astro';

export const renderers: Record<SectionType, AstroComponentFactory> = {
  heading: HeadingBlock,
  lead: LeadBlock,
  text: TextBlock,
  quote: QuoteBlock,
  pullquote: PullquoteBlock,
  callout: CalloutBlock,
  code: CodeBlock,
  image: ImageBlock,
  'image-row': ImageRowBlock,
  gallery: GalleryBlock,
  portrait: PortraitBlock,
  video: VideoBlock,
  game: GameBlock,
  columns: ColumnsBlock,
  divider: DividerBlock,
  spacer: SpacerBlock,
  links: LinksBlock,
  button: ButtonBlock,
  toc: TocBlock,
  stats: StatsBlock,
  latest: LatestBlock,
  feed: FeedBlock,
  pinned: PinnedBlock,
  games: GamesBlock,
  author: AuthorBlock,
  newsletter: NewsletterBlock,
};
