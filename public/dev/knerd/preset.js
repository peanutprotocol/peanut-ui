/** Approved Follow the pull preset. The reference demo and DS table import this object. */
export const FOLLOW_THE_PULL = Object.freeze({
    name: 'Follow the pull',
    tag: 'Softer interaction',
    description:
        'Letters spring up into place, then lean toward your cursor. Release them and they settle back with a small bounce.',
    composition: 'Wide on desktop, stacked on phones',
    entrance: 'Rise from below · light overshoot',
    response: 'Soft attraction · quiet at rest',
    touch: 'Tap to pull the nearest letters in',
    duration: 1050,
    stagger: 38,
    drop: 0.17,
    rotation: -5,
    force: 24,
    radius: 190,
    stiffness: 0.07,
    damping: 0.8,
    idle: 0,
    attraction: true,
    layout: 'wide',
})
