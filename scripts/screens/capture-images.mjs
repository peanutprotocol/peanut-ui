export const REMOTE_IMAGE_PLACEHOLDER = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">
  <rect width="24" height="24" rx="12" fill="#F0EEF3"/>
  <circle cx="12" cy="9" r="3" fill="#8A8491"/>
  <path d="M6.5 19c.8-3.1 2.7-4.7 5.5-4.7s4.7 1.6 5.5 4.7" stroke="#8A8491" stroke-width="2" stroke-linecap="round"/>
</svg>`.trim()

export function isRemoteOptimizedImage(requestUrl, appOrigin) {
    try {
        const request = new URL(requestUrl)
        if (request.origin !== appOrigin || request.pathname !== '/_next/image') return false
        const source = request.searchParams.get('url')
        if (!source) return false
        const image = new URL(source, appOrigin)
        return ['http:', 'https:'].includes(image.protocol) && image.origin !== appOrigin
    } catch {
        return false
    }
}
