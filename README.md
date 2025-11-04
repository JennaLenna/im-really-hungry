# Pixel RPG — Title Screen Demo

This small demo renders a pixel-art title screen using an offscreen low-resolution buffer that gets scaled up with nearest-neighbor interpolation so the visuals stay blocky/pixelated.

Files added:
- `index.html` — page entry
- `src/styles.css` — basic centering and pixelation-friendly styles
- `src/game.js` — canvas renderer: sky + jagged-edged wood plank

How to run:
1. Open `index.html` in a browser (double-click or use a local static server).
2. The title screen will render automatically. Resize the window to see responsive scaling while remaining pixelated.

If you want to serve with a simple local server (recommended to avoid any browser file restrictions):

```bash
# from workspace root
python3 -m http.server 8000
# then open http://localhost:8000/
```

Next steps (optional): add interactive controls, a menu, animated clouds, and a pixel-font.
# im-really-hungry
like really hungry 
