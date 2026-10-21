import localFont from 'next/font/local'

// The root layout loads the Knerd faces with preload: false because site-wide
// they sit below the fold. On the star LPs Knerd is the hero h1, so these
// routes declare the same files with preload on: next/font emits the
// <link rel="preload" as="font"> only for routes that import this module, and
// StarLpPage applies the variables so the preloaded face is the one used.
// display: block, as the Follow the pull reference (hero.css): the hero is
// fitted to Knerd, so a fallback face would paint at the wrong size first.
export const starLpKnerdOutline = localFont({
    src: '../../../assets/fonts/knerd-outline.woff2',
    variable: '--font-knerd-outline',
    display: 'block',
    preload: true,
})

export const starLpKnerdFilled = localFont({
    src: '../../../assets/fonts/knerd-filled.woff2',
    variable: '--font-knerd-filled',
    display: 'block',
    preload: true,
})
