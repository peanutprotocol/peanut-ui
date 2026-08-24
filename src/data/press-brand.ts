// Brand & assets data for /press/brand.
//
// This is design-system reference data (palette hexes, type rules, file
// manifests) rather than marketing prose, so it lives in code next to the
// files it describes rather than in the mono content mirror. The prose press
// kit — boilerplate, taglines, team, company facts — stays on /press and is
// authored in mono at content/press/{lang}.md.
//
// Source of truth for the values below:
//   palette      → tailwind.config.js + Brand Guidelines v1.2 p.25
//   typography   → Brand Guidelines v1.2 p.17-23
//   logo rules   → Brand Guidelines v1.2 p.5-7

export interface BrandColor {
    name: string
    hex: string
    note: string
}

export const BRAND_COLORS: BrandColor[] = [
    { name: 'Pink', hex: '#FF90E8', note: 'Primary. The key-visual ground.' },
    { name: 'Yellow', hex: '#FFC900', note: 'Secondary. The mascot and accents.' },
    { name: 'Lavender', hex: '#90A8ED', note: 'Secondary.' },
    { name: 'Cream', hex: '#FAF4F0', note: 'Neutral ground.' },
    { name: 'Black', hex: '#000000', note: 'Type, outlines, 1px borders.' },
    { name: 'White', hex: '#FFFFFF', note: 'Type on dark and pink grounds.' },
]

export interface BrandTypeRole {
    role: string
    face: string
    note: string
}

export const BRAND_TYPE: BrandTypeRole[] = [
    { role: 'Titles', face: 'Roboto Flex ExtraBold', note: 'Available from Google Fonts.' },
    { role: 'Body copy', face: 'Roboto Flex Regular', note: 'Available from Google Fonts.' },
    {
        role: 'Accent lettering',
        face: 'KNERD Filled + Outline',
        note: 'Display only, never body copy. Download below.',
    },
]

export const LOGO_RULES = {
    do: [
        'Keep clear space of at least 1× the height of the P on every side.',
        'Use the full logotype where the brand is unfamiliar; the icon alone where it is not.',
        'Place the black wordmark on light or pink grounds.',
    ],
    dont: [
        'Do not recolour, rotate, outline or add effects to the mark.',
        'Do not set the black wordmark on a dark ground — use the icon alone instead.',
        'Do not rebuild the KNERD accent lettering as flat black type. It is always the three-layer offset: filled in the background colour, filled white shifted right, black outline on top.',
    ],
}

export interface BrandFile {
    name: string
    href: string
    meta: string
}

export interface BrandFileGroup {
    label: string
    description: string
    files: BrandFile[]
}

export const BRAND_FILE_GROUPS: BrandFileGroup[] = [
    {
        label: 'Logotype',
        description: 'Icon and wordmark locked up together. The default mark.',
        files: [
            { name: 'SVG', href: '/press/assets/Peanut_Full_Logotype.svg', meta: 'vector' },
            { name: 'EPS', href: '/press/assets/Peanut_Full_Logotype.eps', meta: 'vector' },
            { name: 'AI', href: '/press/assets/Peanut_Full_Logotype.ai', meta: 'vector' },
            { name: 'PNG', href: '/press/assets/raster/Peanut_Full_Logotype-1200.png', meta: '1200×293' },
        ],
    },
    {
        label: 'Icon',
        description: 'The mascot mark alone. Use for avatars and app tiles.',
        files: [
            { name: 'SVG', href: '/press/assets/Peanut_Icon.svg', meta: 'vector' },
            { name: 'EPS', href: '/press/assets/Peanut_Icon.eps', meta: 'vector' },
            { name: 'PNG', href: '/press/assets/raster/peanut-icon-1024.png', meta: '1024×1024' },
            { name: 'PNG on pink', href: '/press/assets/raster/peanut-icon-1024-pink.png', meta: '1024×1024' },
            { name: 'PNG small', href: '/press/assets/raster/peanut-icon-512.png', meta: '512×512' },
        ],
    },
    {
        label: 'Wordmark',
        description: 'Type alone, for lockups that already carry the icon.',
        files: [
            { name: 'SVG', href: '/press/assets/Peanut_Wordmark.svg', meta: 'vector' },
            { name: 'EPS', href: '/press/assets/Peanut_Wordmark.eps', meta: 'vector' },
            { name: 'AI', href: '/press/assets/Peanut_Wordmark.ai', meta: 'vector' },
            { name: 'PNG', href: '/press/assets/raster/Peanut_Wordmark-1200.png', meta: '1200×248' },
        ],
    },
    {
        label: 'Social images',
        description: 'Ready-sized cover art for link previews and directory listings.',
        files: [
            { name: 'Landscape', href: '/press/assets/social/peanut-og-1200x630.png', meta: '1200×630' },
            { name: 'Square', href: '/press/assets/social/peanut-social-1200x1200.png', meta: '1200×1200' },
        ],
    },
    {
        label: 'Type',
        description: 'KNERD accent face. Roboto Flex comes from Google Fonts.',
        files: [
            { name: 'KNERD Filled', href: '/press/assets/font/KNERDFilled-Regular.woff2', meta: 'woff2' },
            { name: 'KNERD Outline', href: '/press/assets/font/KNERDOutline-Regular.woff2', meta: 'woff2' },
            { name: 'Fill', href: '/press/assets/font/Fill.otf', meta: 'otf' },
            { name: 'Outline', href: '/press/assets/font/Outline.otf', meta: 'otf' },
        ],
    },
    {
        label: 'Guidelines',
        description: 'The full brand book. Read this before designing anything.',
        files: [{ name: 'Brand Guidelines', href: '/press/assets/Peanut_Brand_Guidelines.pdf', meta: 'PDF · v1.2' }],
    },
]

export interface Screenshot {
    slug: string
    label: string
}

export const SCREENSHOTS: Screenshot[] = [
    { slug: '01-hero', label: 'Balance' },
    { slug: '02-qr-pay-local', label: 'Pay by QR' },
    { slug: '04-send', label: 'Send' },
    { slug: '05-add-money', label: 'Add money' },
    { slug: '06-withdraw', label: 'Withdraw' },
]

export const SCREENSHOT_LOCALES = [
    { dir: 'en', label: 'English' },
    { dir: 'pt-BR', label: 'Português (BR)' },
    { dir: 'es-AR', label: 'Español (AR)' },
]

export const SCREENSHOT_SIZE = { width: 1080, height: 1920 }

export const MASCOTS = [
    { slug: 'peanut-waving-hello', label: 'Waving' },
    { slug: 'peanut-cool', label: 'Cool' },
    { slug: 'peanut-walking', label: 'Walking' },
    { slug: 'peanut-pointing-down', label: 'Pointing' },
    { slug: 'peanut-angry', label: 'Angry' },
]
