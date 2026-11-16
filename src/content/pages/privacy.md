---
title: What this site knows about you
seoTitle: Privacy
description: What {site.name} collects about you (anonymous visit counts, no cookies), where the newsletter form goes, and how to unsubscribe.
sections:
  - type: lead
    text: Very little. This page says what, and why.
  - type: heading
    level: 2
    text: The short version
  - type: text
    text: "This site has no advertising, no comments and no cookies. It counts visits with Cloudflare Web Analytics, which comes from Cloudflare, the company that hosts the site. Apart from that, pages don't load anything from other companies: the fonts, icons and scripts all come from this site."
  - type: heading
    level: 2
    text: Visit counts
  - type: text
    text: "To see which pages people read, each public page loads a small script from [Cloudflare Web Analytics](https://www.cloudflare.com/web-analytics/). It reports the page's address, the page that linked you here, your browser, device type and country, and how fast the page loaded. It sets no cookies and saves nothing on your device, so it can't recognize you on a later visit. I see totals, such as how many visits a page got, not who made them. [Cloudflare's privacy policy](https://www.cloudflare.com/privacypolicy/) covers what Cloudflare does with the data."
  - type: heading
    level: 2
    text: What stays on your device
  - type: text
    text: This site does not save anything in your browser's local storage or cookies.
  - type: heading
    level: 2
    text: The newsletter
  - type: text
    text: |-
      {if newsletter connected}
      If you subscribe, your email address is sent to **{newsletter.provider}**, the service that stores the list and sends the emails. I use it to send the weekly newsletter, and for nothing else. That is the only time the form contacts anyone: the request is made when you press Subscribe, not when the page loads.

      You get one email first, to confirm you meant to sign up; until you confirm, nothing else is sent. Every email has an unsubscribe link. Using it removes you from the list.
  - type: text
    text: |-
      {if newsletter not connected}
      The newsletter isn't connected yet. The sign-up form on this site does not send your address anywhere, and nothing is stored. When it is connected, this page will name the service that holds the list.
  - type: text
    text: |-
      {if waitlist on}

      ## The waitlist

      If you join the waitlist for R7 Orbit, your email address is stored with the date and the page you joined from, in a list kept with Cloudflare, which hosts this site. To keep bots out, the form uses Cloudflare Turnstile, which loads from Cloudflare only once you start using the form.

      You can take your address off the list at any time: [remove my email](/waitlist/remove/).
  - type: heading
    level: 2
    text: Videos and links to other sites
  - type: text
    text: A video on this site shows a still image first and loads from YouTube only after you press play. Links to other sites, including YouTube, take you away from this one, and their own privacy rules apply there.
  - type: heading
    level: 2
    text: Server logs
  - type: text
    text: Like any website, whatever serves these pages can see the address and browser details of each request. I don't use those logs to follow anyone.
  - type: text
    text: Last updated Nov 16, 2026.
---
