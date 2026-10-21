---
title: A blog post written as *sections*
date: 2026-10-01
summary: Fixture for the tests, not part of the site. A blog post whose body is a list of blocks instead of Markdown.
waitlist: true
tags:
  - fixture-sections
author: r7
sections:
  - type: lead
    text: This is a **fixture** for the tests. Its body is a list of blocks in the front matter, and the file has no Markdown body.
  - type: heading
    text: Why the body is a *list*
    level: 2
  - type: text
    text: |-
      Every block is checked by the same schema as the About page. The word quasarbloom appears only here, so the search test can look for it and know the text of a section was indexed.

      A post written this way still gets its reading time, its contents list and its feed item from the blocks. The contents list beside this text is built from the Heading blocks and from the headings written inside Text blocks, like the one just below.

      ### A heading inside a text block

      This paragraph sits under a sub-heading that was typed in Markdown inside a Text block, with two hash marks and a third. It should appear in the contents list, nested under the heading above, and the link there should jump to it. [The about page](/about/) is a link on this site.
  - type: callout
    kind: tip
    title: A tip in the fixture
    text: Callouts keep their label and their colour. This one is a tip, so it is brass.
  - type: heading
    text: How the page *reads* them
    level: 2
  - type: text
    text: |-
      The blocks sit in the reading column of the post, beside the contents list on a wide screen and above it on a phone. Blocks that need room, like a wide picture or two columns, take the full width of that column but never more, so nothing pushes past the edge of the window.

      - a list item in the fixture
      - another list item
  - type: image
    image: /og-default.png
    alt: The brand image of the site, used as a fixture picture
    caption: A wide picture in a post is as wide as the text column.
    width: wide
  - type: quote
    text: A short quotation in the fixture, set in the display face.
    attribution: The fixture
  - type: code
    lang: bash
    title: A code block in the fixture
    code: |-
      npm run build
      npm test
  - type: heading
    text: What a *feed* gets
    level: 2
  - type: text
    text: A feed reader gets the same blocks as plain Markdown turned into HTML, with every address made absolute. Pictures keep their alt text and their captions, links keep their addresses, and blocks that only make sense on the page, like a spacer, are left out.
  - type: columns
    ratio: "1:1"
    left: The **left** column of the fixture.
    right: The *right* column of the fixture.
  - type: links
    items:
      - label: A page on this site
        url: /about/
      - label: Another site
        url: https://example.com/
        note: example
  - type: button
    label: About
    url: /about/
  - type: divider
    style: dots
  - type: text
    text: The last paragraph of the fixture post. It ends the body, and the share row and the previous and next links follow, as on any blog post.
---
