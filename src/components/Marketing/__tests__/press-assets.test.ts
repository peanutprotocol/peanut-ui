import {
    canLabelByExtension,
    downloadLinkProps,
    extOf,
    groupKind,
    pillLabel,
    previewHrefs,
    safeHttpUrl,
} from '../pressAssets'

const logotype = [
    { name: 'Peanut_Full_Logotype.svg', href: '/press/assets/Peanut_Full_Logotype.svg' },
    { name: 'Peanut_Full_Logotype.eps', href: '/press/assets/Peanut_Full_Logotype.eps' },
    { name: 'Peanut_Full_Logotype.ai', href: '/press/assets/Peanut_Full_Logotype.ai' },
]

const font = [
    { name: 'Outline.ttf', href: '/press/assets/font/Outline.ttf' },
    { name: 'Outline.otf', href: '/press/assets/font/Outline.otf' },
    { name: 'Fill.ttf', href: '/press/assets/font/Fill.ttf' },
]

const mascot = [
    { name: 'peanut-waving-hello.webp', href: '/press/assets/mascots/peanut-waving-hello.webp' },
    { name: 'peanut-cool.webp', href: '/press/assets/mascots/peanut-cool.webp' },
    { name: 'peanut-walking.webp', href: '/press/assets/mascots/peanut-walking.webp' },
    { name: 'peanut-pointing-down.webp', href: '/press/assets/mascots/peanut-pointing-down.webp' },
    { name: 'peanut-angry.webp', href: '/press/assets/mascots/peanut-angry.webp' },
    { name: 'GitHub repo (source)', href: 'https://github.com/peanutprotocol/peanut-animations' },
]

describe('press asset grouping', () => {
    it('previews the svg of an svg/eps/ai group and labels the pills by extension', () => {
        expect(groupKind(logotype)).toBe('image')
        expect(previewHrefs(logotype)).toEqual(['/press/assets/Peanut_Full_Logotype.svg'])
        expect(canLabelByExtension(logotype)).toBe(true)
        expect(logotype.map((file) => pillLabel(file, true))).toEqual(['SVG', 'EPS', 'AI'])
    })

    it('renders a font group as a specimen and keeps filenames on the pills', () => {
        expect(groupKind(font)).toBe('font')
        expect(previewHrefs(font)).toEqual([])
        expect(canLabelByExtension(font)).toBe(false)
        expect(font.map((file) => pillLabel(file, false))).toEqual(['Outline.ttf', 'Outline.otf', 'Fill.ttf'])
    })

    it('shows every mascot thumb and keeps filenames when an href has no extension', () => {
        expect(groupKind(mascot)).toBe('image')
        expect(previewHrefs(mascot)).toHaveLength(5)
        expect(previewHrefs(mascot).every((href) => href.endsWith('.webp'))).toBe(true)
        expect(extOf('https://github.com/peanutprotocol/peanut-animations')).toBe('')
        expect(canLabelByExtension(mascot)).toBe(false)
    })

    it('caps the well at five thumbs so it stays one row tall', () => {
        const sixImages = Array.from({ length: 6 }, (_, i) => ({
            name: `shot-${i}.png`,
            href: `/press/assets/shot-${i}.png`,
        }))
        expect(previewHrefs(sixImages)).toHaveLength(5)
        expect(previewHrefs(sixImages)).not.toContain('/press/assets/shot-5.png')
    })

    it('classifies a pdf-only group as plain', () => {
        expect(groupKind([{ name: 'Guidelines.pdf', href: '/press/assets/Peanut_Brand_Guidelines.pdf' }])).toBe('plain')
    })

    it('strips querystring and hash before reading the extension', () => {
        expect(extOf('/press/assets/Peanut_Icon.svg?v=2')).toBe('svg')
        expect(extOf('/press/assets/Peanut_Icon.svg#layer')).toBe('svg')
        expect(extOf('/press/assets/no-extension')).toBe('')
    })

    it('drops non-https hrefs', () => {
        expect(safeHttpUrl('/press/assets/Peanut_Icon.svg')).toBe('/press/assets/Peanut_Icon.svg')
        expect(safeHttpUrl('javascript:alert(1)')).toBeUndefined()
        expect(safeHttpUrl('http://peanut.me/press/assets/Peanut_Icon.svg')).toBeUndefined()
        // A protocol-relative href resolves to https, so safeHttpUrl lets it through —
        // downloadLinkProps is what stops it being treated as a same-origin file.
        expect(safeHttpUrl('//evil.com/x.png')).toBe('//evil.com/x.png')
    })

    it('only downloads same-origin hrefs', () => {
        expect(downloadLinkProps('/press/assets/x.svg')).toEqual({ download: true })
        expect(downloadLinkProps('https://github.com/x')).toEqual({ target: '_blank', rel: 'noopener noreferrer' })
        expect(downloadLinkProps('//evil.com/x.png')).toEqual({ target: '_blank', rel: 'noopener noreferrer' })
    })
})
