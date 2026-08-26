// Preview + label rules for the /press brand-asset grid. Groups come from
// author-supplied mono frontmatter (content/press/{lang}.md) that ships without
// code review, so nothing here may assume a well-formed filename or protocol.

export interface PressAssetFile {
    name: string
    href: string
}

export interface PressAssetGroup {
    label: string
    files?: PressAssetFile[]
}

export type PressGroupKind = 'image' | 'font' | 'plain'

const PEANUT_ORIGIN = 'https://peanut.me'
const IMAGE_EXTENSIONS = new Set(['svg', 'png', 'jpg', 'jpeg', 'webp', 'gif'])
const FONT_EXTENSIONS = new Set(['ttf', 'otf', 'woff', 'woff2'])

/** Only emit https URLs so a `javascript:` or `data:` frontmatter value can't reach a rendered href. */
export function safeHttpUrl(url: string | undefined): string | undefined {
    if (!url) return undefined
    try {
        return new URL(url, PEANUT_ORIGIN).protocol === 'https:' ? url : undefined
    } catch {
        return undefined
    }
}

/**
 * Same-origin files download in place; anything cross-origin opens in a new tab instead —
 * `download` is ignored across origins, so without this the pill navigates the reader away.
 * Resolved rather than pattern-matched so a protocol-relative `//host/x.png` counts as external.
 */
export function downloadLinkProps(href: string): { target?: '_blank'; rel?: string; download?: true } {
    let crossOrigin = true
    try {
        crossOrigin = new URL(href, PEANUT_ORIGIN).origin !== PEANUT_ORIGIN
    } catch {
        crossOrigin = true
    }
    return crossOrigin ? { target: '_blank', rel: 'noopener noreferrer' } : { download: true }
}

/** Lowercased extension of the last path segment, querystring and hash stripped. '' when there is none. */
export function extOf(href: string): string {
    const basename = href.split(/[?#]/)[0].split('/').pop() ?? ''
    const dot = basename.lastIndexOf('.')
    return dot === -1 ? '' : basename.slice(dot + 1).toLowerCase()
}

/** Classify the group, not each file: one well per card. */
export function groupKind(files: PressAssetFile[]): PressGroupKind {
    if (files.some((file) => IMAGE_EXTENSIONS.has(extOf(file.href)))) return 'image'
    if (files.some((file) => FONT_EXTENSIONS.has(extOf(file.href)))) return 'font'
    return 'plain'
}

/** Previewable hrefs in author order, capped so the well stays one row tall. */
export function previewHrefs(files: PressAssetFile[], limit = 5): string[] {
    return files
        .filter((file) => IMAGE_EXTENSIONS.has(extOf(file.href)))
        .slice(0, limit)
        .map((file) => file.href)
}

/** An extension is a safe pill label only when every file has one and they are all distinct. */
export function canLabelByExtension(files: PressAssetFile[]): boolean {
    const exts = files.map((file) => extOf(file.href))
    return exts.every(Boolean) && new Set(exts).size === exts.length
}

export function pillLabel(file: PressAssetFile, useExt: boolean): string {
    return useExt ? extOf(file.href).toUpperCase() : file.name
}
