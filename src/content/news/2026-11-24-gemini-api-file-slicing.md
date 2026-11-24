---
title: "The Gemini API can now read *only the parts of a file* you ask for"
seoTitle: "Google adds file slicing to the Gemini API"
date: 2026-11-24
summary: "The Gemini API can now load only chosen pages, cell ranges, media clips and content layers of an uploaded file, and bills only for the parts it inspects."
sourceUrl: https://blog.google/innovation-and-ai/technology/developers-tools/file-slicing-controls/
sourceName: Google
topic: tools
tags: [ai-agents, google]
cover: /media/news/gemini-api-file-slicing.webp
coverAlt: "Google's share image for the launch: a black background with a blurred band of blue, red, yellow and green light along the bottom, a white four-pointed sparkle and the words Gemini API near the top, and Introducing File Slicing Controls in large white type on two lines in the middle"
coverCredit: Google
author: pulsar
draft: false
---

Google launched file slicing controls in the Gemini API on Nov 23, 2026, in Google AI Studio and the Gemini platform ([Google](https://blog.google/innovation-and-ai/technology/developers-tools/file-slicing-controls/)). A developer or an agent uploads a file once and asks for only the pages, spreadsheet cells, media segments and content layers it needs, and tokens are billed only for the parts Gemini inspects.

> [!NUMBERS] Launch partners' own testing, as reported by Google
> - **14x** fewer tokens for Vercel, skimming a page's text instead of rendering the whole PDF
> - **67%** fewer prompt tokens for a PDF in LiteLLM's testing
> - **33%** fewer prompt tokens for a workbook in LiteLLM's testing
>
> Source: [Google](https://blog.google/innovation-and-ai/technology/developers-tools/file-slicing-controls/)

## What happened

The same launch adds native upload of Microsoft Office and OpenDocument files. A file goes to the Files API once, and its URI can be reused across turns and tool calls, including inside a function response, where an agent names the part of the file it wants. The feature works across all Gemini 4 models, and existing file size and page limits still apply ([Google](https://blog.google/innovation-and-ai/technology/developers-tools/file-slicing-controls/)).

The controls by media category ([Google](https://blog.google/innovation-and-ai/technology/developers-tools/file-slicing-controls/)):

- **Documents and slides** (PDF, Office, OpenDocument): a page range, a resolution of low, medium or high, and page text or page images
- **Spreadsheets** (.xlsx, .xls, .ods): a worksheet tab and cell range, a resolution, and data, formulas or visuals
- **Video**: a time interval, fps and resolution, and the transcript, frames or audio
- **Audio**: a time interval

With no options set, documents and slides load as page images that keep their layout, and spreadsheets load values, formulas and sheet names from every tab.

## Why it matters

Google says that when an API takes only whole files, agent harnesses end up running LibreOffice, PDF renderers and ffmpeg on the client to cut files down, which uses memory and disk and pushes companies to keep a sandbox for each user. With slicing, the API renders and splits the file on Google's servers. Google suggests skimming a file as cheap extracted text first, then reading only the pages or frames that matter at high resolution ([Google](https://blog.google/innovation-and-ai/technology/developers-tools/file-slicing-controls/)).

The savings figures above come from Vercel and LiteLLM. The post gives no savings measured by Google and no prices beyond billing for the inspected parts.

## Sources

- [Introducing file slicing controls in the Gemini API (Google)](https://blog.google/innovation-and-ai/technology/developers-tools/file-slicing-controls/)
