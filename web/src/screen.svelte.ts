// The one answer to "is this the phone layout?", "is the pointer coarse?", and "is this a phone on its
// side?" (docs/specs/mobile.md). screen is reactive state, so components and effects follow it; plain
// code reads it when it runs. The styles read the same answers from the page root: html[data-phone],
// html[data-coarse], and html[data-short].

// The phone layout applies at this width or less, whatever the device (decision 115).
export const PHONE_WIDTH = 640;

export const screen = $state({ phone: false, coarse: false, short: false });

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
follow(`(max-width: ${PHONE_WIDTH}px)`, "phone");
// A coarse pointer cannot hover: touch gets by tap what a mouse gets by hover.
follow("(pointer: coarse)", "coarse");
// A touch screen too short for the desktop's floating panels: a phone on its side, which is wider than
// the phone layout and so has the desktop layout (story 44), with what floats rearranged to fit.
follow("(pointer: coarse) and (max-height: 500px)", "short");
