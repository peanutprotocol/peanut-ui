// Canonical home for the Peanut mascot character assets.
// Everything mascot-shaped lives here — stills as images, animated poses as Lottie comps.
// Import stills from '@/assets/mascot' only; do not reach for raw file paths.
// Animated poses are not exported here: render <PeanutMascot pose="cheering" /> from
// '@/components/Global/PeanutMascot', which loads ./lottie/<pose>.json on demand.

import PEANUT_POINTING from './peanut-pointing.webp'
import PEANUT_TOO_COOL from './peanut-too-cool.webp'
import PEANUT_WHISTLING from './peanut-whistling.webp'

// Stills
export { default as PEANUTMAN } from './peanutman.svg'
export { default as PEANUTMAN_PFP } from './peanut-pfp.svg'
export { default as PEANUTMAN_HOLDING_BEER } from './peanut-beer.svg'
export { default as PEANUTMAN_MOBILE } from './peanut-club.webp'

// Share-asset stills. The card-rejection share image is drawn with D3, then captured
// and serialized into a shareable picture — a live Lottie cannot flow through that
// pipeline, so these three rasters stay on disk for that one call site.
export const MASCOT_SHARE_ASSET_SRC = {
    'too-cool': PEANUT_TOO_COOL.src,
    pointing: PEANUT_POINTING.src,
    whistling: PEANUT_WHISTLING.src,
} as const
