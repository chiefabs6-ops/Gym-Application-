# Exercise illustrations: licence

The images in this folder are adapted from the **RepDB** free-tier exercise dataset:
https://github.com/RepDB/exercise-dataset (licence: `LICENSE-DATA.md` in that repository, v1.0).

- Licence terms: free for personal and commercial use **inside applications**, with attribution.
- **Attribution required:** a visible "Exercise data by RepDB (repdb.co)". The app shows it under every
  illustration (form guide) and on the Settings screen. Keep both.
- **No redistribution as a dataset:** never publish these images (or the source set) as a dataset,
  dataset repository or API. Shipping them inside the app is fine.
- **No generative AI:** never use the images as input, reference or training material for generative
  models (no AI restyling or upscaling).
- Changes made (allowed by term 4, recolouring/cropping for in-app use): recoloured to greyscale with
  plain pixel maths, light-blue background and floor shadows made transparent, cropped, and
  start/peak poses combined side by side into one image.
- The paid-tier preview animations (`premium-samples/` in the source repo) are evaluation-only. Do not use them.

`sources.json` lists which RepDB exercise each file came from.

Regenerate with `python scripts/build-exercise-images.py` (from `apps/mobile`).
