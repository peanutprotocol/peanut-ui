# QR Code Sheet Generator

This script generates an HTML page containing multiple Peanut-branded QR codes that can be printed to PDF. The QR codes include the Peanut logo in the center, matching the style used in the main app.

## Features

- Generates QR codes with the Peanut logo in the center
- Arranges QR codes in a 2-column grid
- Print-friendly layout with proper page breaks
- Shows the link text below each QR code
- Optimized for printing to PDF

## Usage

### From Command Line

You can run the script directly with individual links:

```bash
pnpm run script scripts/generate-qr-sheet.ts output.html "https://peanut.to/claim/link1" "https://peanut.to/claim/link2"
```

### Using a File with Links

For multiple links, create a text file with one link per line:

```
https://peanut.to/claim/link1
https://peanut.to/claim/link2
https://peanut.to/claim/link3
https://peanut.to/claim/link4
```

Then run:

```bash
pnpm run script scripts/generate-qr-sheet.ts output.html --file your-links.txt
```

## Generating the PDF

1. Run the script to create the HTML file
2. Open the HTML file in a browser
3. Press `Ctrl+P` (or `Cmd+P` on Mac) to print
4. Select "Save as PDF" as the destination
5. Make sure "Background graphics" is checked in the print options
6. Click Save

## Implementation Details

The script uses:
- React server-side rendering to generate the HTML
- Client-side JavaScript to generate QR codes
- A data URL for the Peanut logo

The QR codes are styled to match the QRCodeWrapper component used in the main application.