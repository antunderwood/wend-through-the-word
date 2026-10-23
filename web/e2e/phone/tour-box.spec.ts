import { tourBoxSpecs } from "../tour-box";

// The owner's phone (325 x 600), a larger one, and the owner's on its side, in views A and C.
tourBoxSpecs(
  [
    { width: 325, height: 600 },
    { width: 390, height: 844 },
    { width: 760, height: 330 },
  ],
  ["A", "C"],
  true,
);
