/** The atlas: three chapters and the eleven things an explorer can record in them. */

export interface Discovery {
  id: string;
  chapter: 1 | 2 | 3;
  name: string;
  /** position in the original image, 0–1 */
  x: number;
  y: number;
  coords: string;
  note: string;
}

export interface Chapter {
  n: 1 | 2 | 3;
  numeral: string;
  place: string;
  coords: string;
  src: string;
  alt: string;
  width: number;
  height: number;
  /** where the crop centres when the chapter first appears (0–1 across the image) */
  hero: number;
  focusY: number;
}

export const CHAPTERS: Chapter[] = [
  {
    n: 1, numeral: 'I', place: 'The Ember Ridge', coords: '46°34′N · 8°02′E · 3,412 m',
    src: 'images/chapter-01.jpg', width: 1200, height: 636, hero: 0.76, focusY: 0.55,
    alt: 'A wanderer in a long coat holds out a hand to a flock of doves above snow-covered mountains lit orange by the low sun, under a deep slate-blue sky.',
  },
  {
    n: 2, numeral: 'II', place: 'The Hollow Downs', coords: '62°10′N · 7°18′E · 410 m',
    src: 'images/chapter-02.jpg', width: 1200, height: 511, hero: 0.6, focusY: 0.55,
    alt: 'A small figure runs across a dark green hilltop beneath a vast grey dragon whose body and claws dissolve into a pale, cloud-streaked sky.',
  },
  {
    n: 3, numeral: 'III', place: 'The Concrete Tide', coords: 'Block 14 · eastern district · 7th floor',
    src: 'images/chapter-03.jpg', width: 643, height: 329, hero: 0.6, focusY: 0.5,
    alt: 'Pixel art of an enormous whale drifting past the balconies of a concrete apartment block, with more tower blocks and a few birds in the hazy distance.',
  },
];

export const DISCOVERIES: Discovery[] = [
  {
    id: 'wanderer', chapter: 1, name: 'The Wanderer', x: 0.775, y: 0.46, coords: '46°34′12″N · 8°02′51″E',
    note: 'No name on record. Travels in a coat stitched from three older coats and carries a lantern that is never lit. Stops to feed the birds before every climb, as if paying a toll.',
  },
  {
    id: 'offering', chapter: 1, name: 'The Offering', x: 0.53, y: 0.7, coords: '46°34′10″N · 8°02′47″E',
    note: 'Grain from the valley, carried up in a pocket for six days. The doves will not land for anyone who brings bread, and nobody knows how they can tell.',
  },
  {
    id: 'doves', chapter: 1, name: 'Ash Doves', x: 0.33, y: 0.3, coords: 'Airborne · 3,460 m',
    note: 'They roost only on peaks the sun reaches first. Old herders say each bird carries one word of a language no one speaks any more, and lets it go at dusk.',
  },
  {
    id: 'teeth', chapter: 1, name: 'The Burning Teeth', x: 0.42, y: 0.745, coords: '46°35′02″N · 8°01′30″E',
    note: 'For eleven minutes each evening the snow glows like banked coals. Surveyors stopped mapping the ridge after it measured a different height on three consecutive days.',
  },
  {
    id: 'warden', chapter: 2, name: 'The Sleeping Warden', x: 0.13, y: 0.2, coords: 'Overhead · altitude unknown',
    note: 'Not a living animal, and not quite cloud. It gathers out of the weather whenever someone crosses the downs alone, and thins away when they reach the far side.',
  },
  {
    id: 'runner', chapter: 2, name: 'The Runner', x: 0.505, y: 0.73, coords: '62°10′04″N · 7°18′22″E',
    note: 'Seen at the same hour every day, always heading east, never arriving. Leaves no prints in the dew. The shepherds have stopped calling out to them.',
  },
  {
    id: 'claws', chapter: 2, name: 'Claws of Rain', x: 0.73, y: 0.62, coords: '62°10′09″N · 7°18′40″E',
    note: 'Where the claws drag across the hill, the grass stays cold all summer. Dig there and you find only smooth grey stones, all lying the same way.',
  },
  {
    id: 'downs', chapter: 2, name: 'The Black Downs', x: 0.57, y: 0.855, coords: '62°09′58″N · 7°17′51″E',
    note: 'Grass so dark it reads as black at noon. It grows over something very large, and in a dry year its outline shows through.',
  },
  {
    id: 'leviathan', chapter: 3, name: 'The Drifting Leviathan', x: 0.6, y: 0.47, coords: 'Block 14 · passing east',
    note: 'It passes the eastern blocks every few years, low enough to darken the stairwells. Residents close their windows, not out of fear, but because the sea air rusts everything.',
  },
  {
    id: 'window', chapter: 3, name: 'A Lit Window', x: 0.25, y: 0.74, coords: 'Block 14 · 7th floor',
    note: 'Third window from the left. Someone keeps a lamp on through the whole passage, every time. The building’s records list the flat as empty.',
  },
  {
    id: 'gulls', chapter: 3, name: 'The Gulls', x: 0.885, y: 0.22, coords: 'Above the eastern blocks',
    note: 'They follow it inland for days, a hundred kilometres from any coast, and leave when it leaves.',
  },
];
