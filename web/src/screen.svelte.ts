// The one answer to "is this the phone layout?", "is the pointer coarse?", and "does the sheet dock at
// the side?" (docs/specs/mobile.md). screen is reactive state, so components and effects follow it;
// plain code reads it when it runs. The styles read the same answers from the page root:
// html[data-phone], html[data-coarse], and html[data-side].

// The phone layout applies at this width or less, whatever the device (decision 115), and on a touch
// screen under this height: a phone on its side (decision 184).
export const PHONE_WIDTH = 640;
export const PHONE_HEIGHT = 500;
const NARROW = `(max-width: ${PHONE_WIDTH}px)`,
  SHORT_TOUCH = `(pointer: coarse) and (height < ${PHONE_HEIGHT}px)`;

export const screen = $state({ phone: false, coarse: false, side: false });

// Each answer follows its media query, so it changes when the window is resized or the device turns.
function follow(query: string, key: keyof typeof screen) {
  const media = matchMedia(query);
  const set = () => {
    screen[key] = media.matches;
    document.documentElement.toggleAttribute(`data-${key}`, media.matches);
  };
  set();
  media.addEventListener("change", set);
}
follow(`${NARROW}, ${SHORT_TOUCH}`, "phone");
// A coarse pointer cannot hover: touch gets by tap what a mouse gets by hover.
follow("(pointer: coarse)", "coarse");
// The phone layout on a screen wider than it is tall: the sheet is a full-height side panel on the
// right instead of a bottom sheet, so the scene keeps the full height (decision 184).
follow(`${NARROW} and (orientation: landscape), ${SHORT_TOUCH} and (orientation: landscape)`, "side");
