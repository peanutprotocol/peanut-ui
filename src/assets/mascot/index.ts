// Canonical home for the Peanut mascot character assets.
// Everything mascot-shaped lives here — stills as images, animated poses as Lottie comps.
// Import stills from '@/assets/mascot' only; do not reach for raw file paths.
// Animated poses are not exported here: render <PeanutMascot pose="cheering" /> from
// '@/components/Global/PeanutMascot', which loads ./lottie/<pose>.json on demand.

// Stills
export { default as PEANUTMAN } from './peanutman.svg'
export { default as PEANUTMAN_PFP } from './peanut-pfp.svg'
export { default as PEANUTMAN_HOLDING_BEER } from './peanut-beer.svg'
export { default as PEANUTMAN_MOBILE } from './peanut-club.webp'
