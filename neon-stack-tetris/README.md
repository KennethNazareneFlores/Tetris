# Neon Stack — Tetris Arcade

A responsive Tetris-style browser game built with plain HTML, CSS, and JavaScript. It requires no build step, backend, API key, or external package installation.

## Run it locally

1. Download or clone this folder.
2. Open `index.html` in a modern browser.

For a local web server, you can also open the folder in VS Code and use the Live Server extension.

## Controls

- **← / →** or **A / D** — move the piece
- **↓** or **S** — soft drop
- **↑** or **X** — rotate clockwise
- **Z** — rotate counter-clockwise
- **Space** — hard drop
- **C** or **Shift** — hold piece
- **P** or **Esc** — pause / resume
- **R** — restart
- **Enter** — start from the title screen / play again

Touch controls are available on narrow/mobile screens. Sound effects are optional and off by default. The best score is saved in the browser on the device being used.

## Publish with GitHub and Vercel

### 1. Put the project on GitHub

1. Sign in to [GitHub](https://github.com/) and create a new repository (for example, `neon-stack-tetris`).
2. Upload `index.html`, `style.css`, `game.js`, and `README.md` to the repository root. Keep all four files together.
3. Commit the files to the `main` branch.

You can alternatively use Git from this folder:

```bash
git init
git add index.html style.css game.js README.md
git commit -m "Create Neon Stack Tetris game"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/neon-stack-tetris.git
git push -u origin main
```

Replace `YOUR-USERNAME` with your GitHub username and use your actual repository URL.

### 2. Deploy it on Vercel

1. Sign in to [Vercel](https://vercel.com/) using GitHub.
2. Choose **Add New → Project** and import your `neon-stack-tetris` repository.
3. Since this is a static site, leave the framework preset as **Other** (or no framework), leave the build command blank, and leave the output directory as the project root/default (`.` if it asks for a value).
4. Click **Deploy**.
5. After deployment, Vercel provides a public `.vercel.app` URL. Open it to test your live game.

Future commits pushed to the connected GitHub branch trigger a new Vercel deployment automatically.

## Project files

- `index.html` — page structure and game interface
- `style.css` — responsive styling and mobile touch controls
- `game.js` — game logic, drawing, scoring, keyboard input, and saved high score
