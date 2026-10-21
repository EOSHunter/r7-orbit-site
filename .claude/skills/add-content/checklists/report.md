# Final report

Keep it short. Use this order.

1. **Files:** every path created or edited (content, pictures, `public/_headers` and `tests/headers.spec.js` if a game or app host was added). Nothing else changed.
2. **Voice:** one line: the `orbit-voice` skill was invoked by name (or why not), and the claims it asked you to flag.
3. **Layout report:** one line, in this shape:
   `Layout: games post, MDX. Blocks: lead, Figure ×2, ImageRow, Pullquote, list, table, Callout (verdict). Hero: featuredImage screenshot-x.png | heroless: <reason> | IMAGE NEEDED. Pictures needed: 2 (listed below). check:layout: 100, 0 warnings | 92, 1 justified (title-case line 12: "Vesper Drift" is a name).`
   Then, if any, **Pictures needed:** one line each: the field or place, what it should show, the size, the file name you would give it.
4. **Front matter used:** the block, verbatim, with `draft` and `date` stated in words ("draft, not published", "scheduled for 2026-11-02").
5. **Verified:** each command run and its result (`check`, `lint`, `build`, `test:unit`, `test:e2e`, Lighthouse if run), the routes seen in `dist/`, the listings, sitemap and search checks, the no-leak check, the screenshot widths (375, 1280) and the console state.
6. **Not verified:** anything you could not run or see, and why. Say it plainly.
7. **Claims to check:** each statement you could not tie to a source the author gave or a link you opened. For an agent's piece, the claims table (claim, source, verdict, fix) and **Parallax's line**: `Parallax: pass` or `Parallax: fail, N fixes open` (or "not fact-checked", and why). Name the agent you wrote as and its `author` slug.
8. **The author must:** upload a missing picture through `/admin` (and give its alt text), confirm a link, a video id or a play URL, review the text before it is credited to a person, set `draft: false` (or confirm the date), and add the game or app host to `public/_headers` if you did not.

Never push or merge: Orbit handles that.
