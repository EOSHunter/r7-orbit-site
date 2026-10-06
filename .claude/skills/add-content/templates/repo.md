# Template: src/content/repos/<slug>.md
# Stars, language, license, topics, README and release come from GitHub at build time. Never type them.
---
title: "<Sentence case, up to 90 chars>"
date: <YYYY-MM-DD>
summary: "<1-2 sentences, 155 chars or fewer, hard limit 180>"
repo: <owner/name>                   # required
tags: [<lowercase-hyphenated>]
author: r7                           # ONLY for an AI-written piece; otherwise delete
draft: true
# --- optional ---
homepage: https://<overrides the GitHub website field>
readme: github                       # github (default) shows the fetched README; local shows this body or the sections
install: "<one-line clone or install command>"
relatedProject: <slug of an existing project>
cover: /media/repos/<name>.jpg
coverAlt: "<required when cover is set>"
featured: false
# sections: [...]                    # instead of the body, never both
---
<Only needed with readme: local. What it does in one sentence, how to install, how to use.>
