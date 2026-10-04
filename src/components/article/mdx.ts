// The components an MDX article can use without importing them. Pass to the renderer:
//   const { Content } = await render(entry);  <Content components={articleComponents} />
import Callout from './Callout.astro';
import CodeBlock from './CodeBlock.astro';
import Divider from './Divider.astro';
import Figure from './Figure.astro';
import Heading from './Heading.astro';
import ImageRow from './ImageRow.astro';
import Paragraph from './Paragraph.astro';
import Prose from './Prose.astro';
import Pullquote from './Pullquote.astro';
import Quote from './Quote.astro';
import Subheading from './Subheading.astro';
import Toc from './Toc.astro';
import TwoColumn from './TwoColumn.astro';
import VideoEmbed from './VideoEmbed.astro';

export const articleComponents = {
  Callout,
  CodeBlock,
  Divider,
  Figure,
  Heading,
  ImageGallery: ImageRow,
  ImageRow,
  Paragraph,
  Prose,
  Pullquote,
  Quote,
  Subheading,
  Toc,
  TwoColumn,
  VideoEmbed,
};
