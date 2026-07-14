// Canonical home for the Peanut mascot character assets.
// Everything mascot-shaped lives here — animated GIFs and stills alike.
// Import from '@/assets/mascot' only; do not reach for raw file paths.

import type { StaticImageData } from 'next/image'

import { isLegacyWebKit } from '@/utils/webkit.utils'

import cheeringGif from './peanut-cheering.gif'
import cheeringWebp from './peanut-cheering.webp'
import cryingGif from './peanut-crying.gif'
import cryingWebp from './peanut-crying.webp'
import pointingDownGif from './peanut-pointing-down.gif'
import pointingDownWebp from './peanut-pointing-down.webp'
import pointingGif from './peanut-pointing.gif'
import pointingWebp from './peanut-pointing.webp'
import sadGif from './peanut-sad.gif'
import sadWebp from './peanut-sad.webp'
import thinkingGif from './peanut-thinking.gif'
import thinkingWebp from './peanut-thinking.webp'
import tooCoolGif from './peanut-too-cool.gif'
import tooCoolWebp from './peanut-too-cool.webp'
import walkingGif from './peanut-walking.gif'
import walkingWebp from './peanut-walking.webp'
import wavingHelloGif from './peanut-waving-hello.gif'
import wavingHelloWebp from './peanut-waving-hello.webp'
import whistlingGif from './peanut-whistling.gif'
import whistlingWebp from './peanut-whistling.webp'

// Legacy/unverifiable WebKit can't animate WebP (see isLegacyWebKit) — it gets the
// GIF fallbacks (bigger files, 1-bit alpha); everyone else the smaller WebP.
const pick = (webp: StaticImageData, gif: StaticImageData): StaticImageData => (isLegacyWebKit() ? gif : webp)

// Animated mascots (alpha background — downscaled 512→320px; webp via gif2webp -q 70)
export const PeanutWhistling = pick(whistlingWebp, whistlingGif) // whistling, peace-sign, mid-stride — chill / effortless: landing hero, setup intro, low-key "you're in" wins
export const PeanutPointing = pick(pointingWebp, pointingGif) // grinning, pointing off-screen
export const PeanutCheering = pick(cheeringWebp, cheeringGif) // both fists up, celebrating — big money wins (claim / payment success, confetti moments)
export const PeanutSad = pick(sadWebp, sadGif) // slumped, frowning, hands on hips — sad / dejected (errors)
export const PeanutCrying = pick(cryingWebp, cryingGif) // teary, hands to face — errors / empty states
export const PeanutTooCool = pick(tooCoolWebp, tooCoolGif) // pixel shades, hand on hip, big grin — confident "too cool" flex
export const PeanutThinking = pick(thinkingWebp, thinkingGif) // pondering — loading / verification waits
export const PeanutWavingHello = pick(wavingHelloWebp, wavingHelloGif) // one arm up, waving — greetings / setup
export const PeanutWalking = pick(walkingWebp, walkingGif) // mid-stride, arms swinging — physical-card waitlist ("on the way / shipping")
export const PeanutPointingDown = pick(pointingDownWebp, pointingDownGif) // both hands pointing down — marketing CTA

// Stills
export { default as PEANUTMAN } from './peanutman.svg'
export { default as PEANUTMAN_PFP } from './peanut-pfp.svg'
export { default as PEANUTMAN_HOLDING_BEER } from './peanut-beer.svg'
export { default as PEANUTMAN_MOBILE } from './peanut-club.webp'
