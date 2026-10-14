# Productive-Fun

## Riso Pagoda Lab

A single-page toy that mixes two illustrations: a riso-printed science textbook cover and a pen-and-ink pagoda sketch.

- **Magnet hero**: hold the mouse (or toggle the Magnet button) and the cloud creatures, bolts and blobs orbit your cursor. The clouds' eyes follow you and blink.
- **Lens test**: a magnifier that re-prints the pagoda in two misregistered riso inks under the glass, with notes on what you're looking at.
- **Press test**: pick an ink for each of two drums, set the misregistration, and pull a print.
- **Puzzle test**: a 4×3 sliding puzzle of the textbook cover, with a per-browser best score.

Serve the folder with any static server (the pagoda uses a CSS mask, which browsers block over `file://`):

```sh
python3 -m http.server
# then visit http://localhost:8000
```

Assets: `assets/cover.jpg` (the cover) and `assets/pagoda.png` (the sketch, cropped and converted to a transparent ink mask).
