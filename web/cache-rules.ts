// The Cache-Control values of decision 157: the stage writes them to _headers and the live check
// expects them, so both read them from here.
export const YEAR = "public, max-age=31536000, immutable";
export const FIVE_MINUTES = "public, max-age=300";
export const REVALIDATE = "public, max-age=0, must-revalidate";
