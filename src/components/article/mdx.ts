// The components an MDX article can use without importing them. Pass to the renderer:
//   const { Content } = await render(entry);  <Content components={articleComponents} />
import AgentCards from './AgentCards.astro';
import Callout from './Callout.astro';
import CodeBlock from './CodeBlock.astro';
import Divider from './Divider.astro';
import Figure from './Figure.astro';
import Heading from './Heading.astro';
import ImageRow from './ImageRow.astro';
import OrbitDiagram from './OrbitDiagram.astro';
import Paragraph from './Paragraph.astro';
import Post from './Post.astro';
import Prose from './Prose.astro';
import Pullquote from './Pullquote.astro';
import Quote from './Quote.astro';
import StatDial from './StatDial.astro';
import Subheading from './Subheading.astro';
import Toc from './Toc.astro';
import TwoColumn from './TwoColumn.astro';
import VideoEmbed from './VideoEmbed.astro';

export const articleComponents = {
  AgentCards,
  Callout,
  CodeBlock,
  Divider,
  Figure,
  Heading,
  ImageGallery: ImageRow,
  ImageRow,
  OrbitDiagram,
  Paragraph,
  Post,
  Prose,
  Pullquote,
  Quote,
  StatDial,
  Subheading,
  Toc,
  TwoColumn,
  VideoEmbed,
};
