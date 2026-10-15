# Beyond the Last Horizon

An interactive field atlas built around three illustrations. Scroll through the opening plate, cross into the second world through a band of mist, find the marks left in each painting, and keep what you find in an explorer's journal.

```sh
npm install
npm run dev      # http://localhost:5173
npm run build    # dist/index.html (code and styles inlined) + dist/images/
```

## Structure of the experience

| Stage | Artwork | What happens |
|---|---|---|
| Opening | `chapter-01.jpg` | Full-screen plate, title, “Begin exploring”. Navigation stays hidden apart from the journal tab. |
| Chapter I · The Ember Ridge | `chapter-01.jpg` | Field note, then four discovery marks. The crop pans from the wanderer to the doves on screens that can't show the whole painting. |
| The crossing | both | Chapter I zooms gently into a pale mist while chapter II fades in and settles into focus. |
| Chapter II · The Hollow Downs | `chapter-02.jpg` | “The World Remembers”, four more marks; the crop pans from the claws to the dragon's head on narrow screens. |
| Epilogue · The Concrete Tide | `chapter-03.jpg` | A pixel-art panorama (kept pixel-sharp) with three marks; on phones it scrolls sideways. |
| End | — | Your tally, the journal, and a way back to the ridge. |

## How it works

- **No animation library.** One passive scroll listener feeds a `requestAnimationFrame` render that maps scroll position to opacity, a small zoom and the crop. Scrolling is never hijacked.
- **Focal-point cropping** (`place` / `route` in `src/main.ts`). Each painting is laid out like `object-fit: cover` but positioned around a focal point. Each chapter's pan route is computed from where its marks are and how much of the painting the current screen can show: if everything fits, the crop centres on the marks; if not, it travels across them as you scroll.
- **Two timelines.** On wide screens (at least 1200 px and landscape) the notes sit beside the marks. Everywhere else a note appears first, then steps aside so the painting is clear to explore.
- **Discoveries** are real `<button>`s with accessible names. They are clickable, tappable and reachable by keyboard (Enter to open, Esc to close, focus returns to the mark). Marks that are cropped off-screen or belong to an inactive chapter are taken out of the tab order.
- **Journal** state lives in `localStorage` (`beyond-horizon:journal:v1`) and survives reloads. Clearing it takes two steps. If storage is blocked the journal still works for the visit and says so.
- **Reduced motion** removes the zoom, the pulsing marks and smooth scrolling. The crossfade remains because it is tied directly to your scrolling.
- **Fallbacks.** A painting that fails to load is replaced by a tinted plate with a short message, and its marks are disabled. Without JavaScript the page shows the paintings and text as a plain illustrated page.

## Artwork

`public/images/` holds the three illustrations unchanged. Chapter I carries the artist's signature (@seiya_ingen). Chapters II and III were supplied without a signature; please add their credits to the footer in `index.html` when known. The place names, coordinates and field notes are fiction written for this site.
