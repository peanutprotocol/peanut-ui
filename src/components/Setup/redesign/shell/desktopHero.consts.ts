import type { MascotPose } from '@/components/Global/PeanutMascot/PeanutMascot.types'
import type { OnboardingAnimationName } from './OnboardingAnimation'
import type { ScreenId } from '@/components/Setup/Setup.types'

export type DesktopHeroArt = { pose: MascotPose } | { animation: OnboardingAnimationName } | { hero: 'residence' }

/**
 * The art of dev's desktop side hero, per screen: the `image` each step had on origin/dev c985d250e
 * (Setup.consts.tsx, setup/finish/page.tsx). Desktop keeps dev's split (owner fleet ruling on R1-02).
 */
export const DESKTOP_HERO_ART: Partial<Record<ScreenId, DesktopHeroArt>> = {
    landing: { pose: 'waving-chill' },
    'advantage-fees': { animation: 'accounts' },
    'advantage-card': { animation: 'card' },
    residence: { hero: 'residence' },
    'payment-plan': { animation: 'add-money' },
    signup: { pose: 'thinking' },
    invite: { animation: 'invite' },
    passkey: { animation: 'finish' },
    'notification-email': { animation: 'email' },
    'notification-permission': { animation: 'notifications' },
    'advantage-control': { animation: 'finish' },
    'sign-test-transaction': { pose: 'waving-chill' },
}

/** Dev's split starts at Tailwind `md`. */
export const DESKTOP_QUERY = '(min-width: 768px)'
