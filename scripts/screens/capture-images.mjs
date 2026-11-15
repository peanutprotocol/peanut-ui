import { readFileSync } from 'node:fs'

export const REMOTE_IMAGE_PLACEHOLDER = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">
  <rect width="24" height="24" rx="12" fill="#F0EEF3"/>
  <circle cx="12" cy="9" r="3" fill="#8A8491"/>
  <path d="M6.5 19c.8-3.1 2.7-4.7 5.5-4.7s4.7 1.6 5.5 4.7" stroke="#8A8491" stroke-width="2" stroke-linecap="round"/>
</svg>`.trim()

// Pin the network chooser's existing chain registry artwork for offline captures.
const networkLogos = new Map(
    [
        ['279/standard/ethereum.png?1706606803', 'ethereum'],
        ['5/standard/solana.png?1706606708', 'solana'],
        ['1094/standard/TRON_LOGO.png?1706606652', 'tron'],
    ].map(([source, name]) => [
        `https://assets.coingecko.com/asset_platforms/images/${source}`,
        readFileSync(new URL(`./assets/network-logos/${name}.png`, import.meta.url)),
    ])
)

export function remoteOptimizedCaptureImage(requestUrl, appOrigin) {
    try {
        const request = new URL(requestUrl)
        if (request.origin !== appOrigin || request.pathname !== '/_next/image') return null
        const source = request.searchParams.get('url')
        if (!source) return null
        const image = new URL(source, appOrigin)
        if (!['http:', 'https:'].includes(image.protocol) || image.origin === appOrigin) return null
        const logo = networkLogos.get(image.href)
        return logo
            ? { contentType: 'image/png', body: logo }
            : { contentType: 'image/svg+xml', body: REMOTE_IMAGE_PLACEHOLDER }
    } catch {
        return null
    }
}
