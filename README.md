# Grandmaster Hub

Grandmaster Hub is a fully client-side chess training portal featuring Stockfish-powered play, curated puzzles, and interactive lessons. The project is designed to deploy seamlessly on GitHub Pages (`https://<user>.github.io/project/`) without any server dependencies.

## Features

- **Play vs Stockfish** – Adjustable Skill Level (0–20), optional 3|2 blitz clock, move highlighting, PGN/FEN export, resign/draw/undo, and lightweight move sounds.
- **Browser-based engine** – Stockfish runs inside a dedicated Web Worker loaded from CDN, keeping the UI responsive.
- **Tactics trainer** – 50+ curated mate-in-one puzzles with adaptive rating, streak tracking, hint arrows generated from Stockfish, and solution playback.
- **Interactive lessons** – Six guided lesson cards with playable diagrams, instructional arrows, and reset-on-drag convenience.
- **Persistent profile** – LocalStorage stores game rating, preferred color, difficulty, clock preference, and puzzle progress.
- **Responsive design** – Tailwind CSS with custom styles provides a polished layout that scales from phones to desktops. High-contrast controls and ARIA live regions improve accessibility.

## Getting started

1. Clone the repository and ensure the folder name is `project` (GitHub Pages expects the path `/<repo>/`).
2. Open `index.html` directly in a modern browser. No build step or local server is required.
3. For development, use a static file server (such as `npx serve`) if you prefer live reload.

## Adding puzzles

1. Edit [`assets/js/puzzles.js`](./assets/js/puzzles.js).
2. Append new puzzle objects with the shape `{ id, fen, solutionSAN: [], rating, theme: [] }`.
3. Ensure the SAN sequence begins with the side to move in the provided FEN. The first move should be the user move. Use a chess engine or the included Stockfish hint feature to verify correctness.

## Extending lessons

- Each lesson card in [`index.html`](./index.html) includes a `<div class="lesson-board">` with `data-fen`, `data-arrows`, and optional `data-orientation` attributes.
- To add a new lesson, copy an existing `lesson-card`, update the text, and set the FEN/arrows for the desired illustration.
- Arrows are rendered from the `data-arrows` attribute using simple UCI-style square pairs (e.g. `e2e4`).

## Deployment

1. Commit changes to the `main` branch.
2. Push to GitHub and enable **GitHub Pages → Deploy from branch → main**.
3. Visit `https://<user>.github.io/project/` to verify the production build.

## License

This project is released under the [MIT License](./LICENSE).
