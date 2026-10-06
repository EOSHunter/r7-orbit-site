# Template: src/content/vlogs/<slug>.md
---
title: "<Sentence case, up to 90 chars>"
seoTitle: "<only if the plain title is over 49 chars; at most 49>"
date: <YYYY-MM-DD>
summary: "<1-2 sentences, 155 chars or fewer, hard limit 180>"
youtubeId: <exactly 11 characters, the part after v=; or use videoUrl instead>
duration: "<m:ss or h:mm:ss, e.g. 12:48>"
tags: [<lowercase-hyphenated>]
author: r7                    # ONLY for an AI-written piece; otherwise delete
draft: true
# --- optional ---
videoUrl: https://<non-YouTube host; only if there is no youtubeId>
poster: /media/vlogs/<name>.jpg      # falls back to cover, then YouTube's thumbnail (fetched at build)
cover: /media/vlogs/<name>.jpg
coverAlt: "<required when cover is set>"
chapters:
  - { t: "0:00", title: "<chapter title>" }
transcript: true              # only if a Markdown body has a "## Transcript" section; not with sections
transcriptText: |-            # only with sections; Markdown
  <transcript>
updated: <YYYY-MM-DD>
featured: false
# sections: [...]             # instead of the body, never both
---
<Short intro to the video, the links and resources it mentions. Do not transcribe the video here.>
