# Postcode Heatmap Australia

A browser-only prototype that turns postcode/value data into an interactive Australian Postal Area heatmap.

## Run locally

The browser blocks data files when you open `index.html` directly, so run a tiny local server:

```bash
python -m http.server 8000
```

Then visit `http://localhost:8000`.

## Deploy without coding

### Netlify Drop (easiest)
1. Unzip this project.
2. Go to Netlify Drop.
3. Drag the entire `postcode-heatmap-app` folder onto the page.
4. Netlify gives you a public URL.

### GitHub Pages / Cloudflare Pages
Upload this folder as a static site. No build command is required.

## Supported files
- CSV
- XLSX / XLS (first worksheet)

## Required data
- A postcode column
- A numeric value column

Duplicate postcodes can be summed, averaged, counted, or reduced to their maximum. Data is processed locally in the user's browser and is not uploaded to a server.

## Geography
Uses ABS Postal Areas 2021 (`POA_CODE21`). Postal Areas are statistical approximations of postcodes. Boundary geometry was simplified for browser performance.

## Important production note
This prototype loads JavaScript libraries and OpenStreetMap tiles from public CDNs. For a more robust production release, pin and self-host dependencies, add a privacy notice, and test export behavior across browsers.
