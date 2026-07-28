# Drive-Thru Portfolio

An interactive 3D portfolio game — inspired by [bruno-simon.com](https://bruno-simon.com/) —
where you drive a toy car around a small Malaysian-flavored city block to
explore Faiq Zharfan's story, skills, work and contact details.

Plain HTML/CSS/JS + [Three.js](https://threejs.org/), no build step, no bundler.
Three.js is vendored locally in `vendor/three/` rather than loaded from a CDN,
so the game works fully offline and isn't dependent on unpkg/jsdelivr uptime.

## Structure

```
index.html        — page shell: loading screen, intro card, HUD, modal root
style.css         — all styling (brand colors match mokinho.github.io)
vendor/three/     — vendored Three.js ES module build (no CDN dependency)
src/
  data.js         — ALL portfolio content (about, skills, contact, 21 projects)
  world.js        — the 3D city: ground/roads, buildings, billboards, decor
  car.js          — the car mesh + arcade driving physics
  controls.js     — keyboard + touch/mobile input handling
  ui.js           — HUD (minimap/speedo/prompt) + modal content rendering
  main.js         — scene setup, render loop, zone-trigger + modal wiring
```

## The world

- **Plaza** (spawn point) — a toy twin-tower landmark at the center.
- **Rumah Faiq** (west, kampung house on stilts) — About + experience timeline.
- **Bengkel Kemahiran** (east, workshop/garage) — Skills & expertise.
- **Jalan Faiq** (the long boulevard heading south) — a "project boulevard"
  lined with 21 roadside billboards, one per project, each with a canvas-
  generated texture. Drive close to one and press **E** to open its details.
- **Kedai Kopi** (end of the boulevard) — Contact links (email, WhatsApp,
  LinkedIn, resume).

## Controls

- **W A S D** or **Arrow keys** — drive
- **E** (or Space) — open a zone when the on-screen prompt appears
- **Esc** — close an open panel
- Touch devices get an on-screen wheel + gas/brake/interact buttons automatically.

## Editing content

All portfolio copy lives in one file: `src/data.js` (`PROFILE`, `ABOUT`,
`SKILLS`, `CONTACT`, `PROJECTS`). Edit that file and the HUD/modals and the
project billboards update automatically — no need to touch `world.js` or
`ui.js` for a content change.

To add/remove a project, add/remove an entry in the `PROJECTS` array in
`src/data.js` (`tag`, `title`, `desc`, `link`, `colorA`/`colorB` for the
billboard gradient). Billboards are generated and spaced automatically along
the boulevard in `src/world.js` (`buildBillboards`), so the boulevard grows
or shrinks with the list.

## Running locally

No build step — just serve the folder:

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000`. (Opening `index.html` directly via
`file://` will NOT work — ES modules and the import map require an HTTP server.)

## Deploying

**GitHub Pages** (free, easiest):
1. Push this repo/folder to a GitHub repo.
2. Repo Settings → Pages → set source to the branch, root folder.
3. Site goes live at `https://<username>.github.io/<repo>/`.

**Netlify / Vercel**: connect the repo, no build command needed, publish
directory is `.`.

## Notes

- Three.js is vendored (`vendor/three/three.module.min.js`, v0.160.0) instead
  of imported from a CDN via the import map, so the game has no runtime
  dependency on unpkg/jsdelivr/cdnjs being reachable.
- Everything in the 3D world (car, buildings, trees, billboards) is built
  procedurally from primitive geometry — there are no external 3D model or
  texture files to manage.
