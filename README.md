# Postcode Heatmap Australia

A browser-only app that turns postcode/value data into an interactive Australian Postal Area heatmap.

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
- CSV with a header row
- XLSX / XLS; the app inspects the first 30 rows of each worksheet and selects the most likely table header

## Required data
- A postcode column
- A numeric value column

Duplicate postcodes can be summed, averaged, counted, or reduced to their minimum or maximum. CSV and Excel contents are processed locally in the user's browser and are not uploaded to a server.

The optional synthetic ecommerce sample is downloaded as a static file from this app. Loading it does not change how user-uploaded files are processed.

## Geography
Uses ABS Postal Areas 2021 (`POA_CODE21`). Postal Areas are statistical approximations of postcodes. Boundary geometry was simplified for browser performance.

## Network access
The app loads its JavaScript libraries and optional map tiles from public CDNs. Uploaded rows, column names and filter selections remain in browser memory and are not included in those requests.
