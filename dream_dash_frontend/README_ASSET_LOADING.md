# Canvas Asset Loading Notes

This project uses a robust image preloading strategy in `src/components/GameCanvas.jsx` to prevent `drawImage` InvalidStateError.

Key points:
- Images are created via `new Image()` and loaded with `onload/onerror`.
- Each asset sets an `ok` flag once loading settles (success or failure).
- The render loop starts only after `Promise.allSettled` completes, meaning initial frames do not attempt to draw before assets are ready.
- Every `drawImage` call is guarded by `canDraw(imgObj)` that verifies:
  - `ok === true`
  - `img.complete === true`
  - `img.naturalWidth > 0`
- If any asset fails to load, a canvas-drawn fallback is used (gradient for background, ellipses for clouds, circle for star, rect for player).
- Two minimal SVG placeholders (`score-bar.svg` and `restart-btn.svg`) are provided to ensure any future references are valid.

How to add new assets:
1. Add the asset file under `src/assets/`.
2. Extend `imagesRef` and the preload `tasks` with the new image using `loadImage`.
3. In the render loop, use `canDraw()` to guard `drawImage` and provide a fallback drawing.

This ensures the game never crashes due to broken image states and remains visually usable even if some assets fail to load.
