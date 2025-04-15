import * as React from 'react'
import * as ReactDOMServer from 'react-dom/server'
import * as fs from 'fs'
import * as path from 'path'

// Get the absolute path to the project root
const projectRoot = path.resolve(__dirname, '..')

// We'll copy the peanut logo to include inline
const peanutLogoPath = path.join(projectRoot, 'public/logo-favicon.png')
const peanutLogoBase64 = fs.readFileSync(peanutLogoPath).toString('base64')

// Create a QR code component based on QRCodeWrapper
const QRCode: React.FC<{ value: string }> = ({ value }) => {
    return React.createElement(
        'div',
        {
            className: 'qr-wrapper',
            style: {
                position: 'relative',
                border: '2px solid black',
                borderRadius: '8px',
                background: 'white',
                padding: '16px',
                width: '150px',
                height: '150px',
                margin: '0 auto',
            },
        },
        [
            // QR code div - we'll use the client-side library to generate the QR code
            React.createElement('div', {
                key: 'qr-code',
                className: 'qr-code-placeholder',
                'data-value': value,
                style: {
                    width: '100%',
                    height: '100%',
                },
            }),
            // Logo overlay - extracting the styling from QRCodeWrapper
            React.createElement(
                'div',
                {
                    key: 'logo-container',
                    style: {
                        position: 'absolute',
                        left: '50%',
                        top: '50%',
                        transform: 'translate(-50%, -50%)',
                        width: '20%',
                        height: '20%',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        background: 'white',
                        borderRadius: '50%',
                        padding: '2px',
                        zIndex: 10,
                    },
                },
                [
                    React.createElement('img', {
                        key: 'logo',
                        src: `data:image/png;base64,${peanutLogoBase64}`,
                        alt: 'Peanut Logo',
                        style: {
                            width: '100%',
                            height: '100%',
                            borderRadius: '50%',
                            objectFit: 'contain',
                        },
                    }),
                ]
            ),
        ]
    )
}

// Generate the full HTML page with multiple QR codes
function generateQRCodesPage(links: string[]): string {
    // Create QR code grid
    const qrCodesGrid = React.createElement(
        'div',
        {
            className: 'qr-grid',
            style: {
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '20px',
            },
        },
        links.map((link, index) => {
            return React.createElement(
                'div',
                {
                    key: index.toString(),
                    className: 'qr-code-container',
                    style: {
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        pageBreakInside: 'avoid',
                        marginBottom: '20px',
                    },
                },
                [
                    React.createElement(QRCode, {
                        key: 'qr',
                        value: link,
                    }),
                    React.createElement(
                        'div',
                        {
                            key: 'label',
                            className: 'qr-label',
                            style: {
                                marginTop: '8px',
                                fontSize: '12px',
                                wordBreak: 'break-all',
                                maxWidth: '200px',
                                textAlign: 'center',
                            },
                        },
                        link
                    ),
                ]
            )
        })
    )

    // Create the page content
    const pageContent = React.createElement('div', null, [
        React.createElement('h1', { key: 'title', className: 'print-instructions' }, 'Peanut QR Codes'),
        React.createElement(
            'p',
            {
                key: 'instructions',
                className: 'print-instructions',
            },
            'Print this page to generate a PDF. Make sure to select "Background Graphics" in print options.'
        ),
        qrCodesGrid,
    ])

    // Convert React elements to HTML string
    const bodyContent = ReactDOMServer.renderToStaticMarkup(pageContent)

    // Create full HTML document with embedded links array
    return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Peanut QR Codes</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          margin: 0;
          padding: 15px;
        }
        .qr-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 20px;
        }
        .qr-code-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          page-break-inside: avoid;
          margin-bottom: 15px;
        }
        .qr-wrapper {
          position: relative;
          border: 2px solid black;
          border-radius: 8px;
          background: white;
          padding: 12px;
          width: 150px;
          height: 1150px;
        }
        .qr-code-placeholder {
          width: 100%;
          height: 100%;
        }
        .qr-code-placeholder canvas {
          width: 100% !important;
          height: 100% !important;
        }
        .qr-label {
          margin-top: 5px;
          font-size: 10px;
          word-break: break-all;
          max-width: 200px;
          text-align: center;
        }
        @media print {
          @page {
            size: A4;
            margin: 1cm;
          }
          body {
            padding: 0;
          }
          .print-instructions {
            display: none;
          }
        }
      </style>
    </head>
    <body>
      ${bodyContent}
      <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
      <script>
        // Generate QR codes for each placeholder
        const qrLinks = ${JSON.stringify(links)};
        
        document.addEventListener('DOMContentLoaded', function() {
          document.querySelectorAll('.qr-code-placeholder').forEach((element, index) => {
            if (index < qrLinks.length) {
              // Clear any previous content
              element.innerHTML = '';
              
              // Generate QR code using QRCode.js
              new QRCode(element, {
                text: qrLinks[index],
                width: 150,
                height: 150,
                colorDark: "#000000",
                colorLight: "#ffffff",
                correctLevel: QRCode.CorrectLevel.H
              });
            }
          });
        });
      </script>
    </body>
    </html>
  `
}

// Main function
function generateQRSheet(links: string[], outputPath: string): void {
    const html = generateQRCodesPage(links)
    fs.writeFileSync(outputPath, html)
    console.log(`QR code sheet generated at: ${outputPath}`)
    console.log('Open this file in a browser and print to PDF')
}

// Handle command line arguments
function main(): void {
    const args = process.argv.slice(2)

    if (args.length < 2) {
        console.log('Usage: pnpm run script scripts/generate-qr-sheet.ts <output-path.html> <link1> <link2> ...')
        console.log('Or: pnpm run script scripts/generate-qr-sheet.ts <output-path.html> --file <links-file.txt>')
        process.exit(1)
    }

    const outputPath = args[0]
    let links: string[] = []

    if (args[1] === '--file') {
        const filePath = args[2]
        const fileContent = fs.readFileSync(filePath, 'utf-8')
        links = fileContent.split('\n').filter((link) => link.trim())
    } else {
        links = args.slice(1)
    }

    generateQRSheet(links, outputPath)
}

// Run the script
main()
