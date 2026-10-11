---
title: "Movie Wheel"
date: 2026-10-11
summary: A wheel that picks tonight's movie from a list you edit. Spin it, watch what it lands on, then mark it watched to take it off the wheel.
tags: [r7-orbit, apps]
status: shipped
stack: [JavaScript, Canvas, Web Audio]
playUrl: https://r7orbit.io/movie-wheel/
appType: app
playMode: link
platforms: [desktop, mobile]
playNote: "Your list is saved in this browser only."
draft: true
---
Movie Wheel is a small app for choosing what to watch. You keep a list of movies, spin the wheel, and watch whatever it lands on. A movie you have watched leaves the wheel and moves to a Watched tab, where you can put it back.

It is drawn on a canvas, with the clicks and the landing chime made in the browser with Web Audio, so there are no sound files. The list stays in your browser's local storage and is never sent anywhere.
