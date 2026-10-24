// The splash's words (decision 203), apart from its layout in Splash.svelte. The description is the
// page's own, in index.html's description, which link previews show.
import type { NodeType } from "./model";

export const SPLASH = {
  title: "Wend Through the Word",
  description: "Explore the Bible as a 3D graph: start at a verse, a person, or a location, and move along the links.",
  start: "Start exploring",
  tour: "Take the tour",
};

// Set in this browser when the splash closes; without it, the splash opens over the app.
export const SPLASH_KEY = "wend.splashSeen";

// The site icon's graph, which the splash draws large: a Person as the Focus at the centre, joined
// to a Neighbour of each other type, as x, y, and type in the icon's 64 x 64 box. web/public/icon.svg
// is a static file that draws the same in the same colours (colours.ts); tests/splash.test.ts checks
// that they agree.
type Disc = readonly [x: number, y: number, type: NodeType];
export const ICON: { focus: Disc; neighbours: readonly Disc[] } = {
  focus: [32, 32, "person"],
  neighbours: [
    [32, 12, "place"],
    [51, 25.8, "event"],
    [43.8, 48.2, "group"],
    [20.2, 48.2, "theme"],
    [13, 25.8, "verse"],
  ],
};
