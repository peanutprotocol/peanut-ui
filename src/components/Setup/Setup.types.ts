import type { OnboardingAnimationName } from './components/OnboardingAnimation'
import type { MascotPose } from '@/components/Global/PeanutMascot/PeanutMascot.types'
import type { PeanutMascotSceneName } from '@/components/Global/PeanutMascot/PeanutMascotScene'

/** A setup screen leads with a still, an animated pose, or a composed mascot scene. */
export type SetupIllustration =
    | { src: string }
    | { pose: MascotPose }
    | { scene: PeanutMascotSceneName }
    | { animation: OnboardingAnimationName }

export type ScreenId =
    | 'landing'
    | 'welcome'
    | 'signup'
    | 'advantage-card'
    | 'advantage-bank'
    | 'advantage-local'
    | 'advantage-exchange'
    | 'advantage-people'
    | 'advantage-fees'
    | 'notification-email'
    | 'advantage-payments'
    | 'residence'
    | 'advantage-rewards'
    | 'passkey-permission'
    | 'advantage-control'
    | 'passkey-success'
    | 'notification-permission'
    | 'add-wallets'
    | 'success'
    | 'join-beta'
    | 'sign-test-transaction'

export type LayoutType = 'signup'

export type ScreenProps = {
    landing: undefined
    welcome: undefined
    signup: undefined
    'advantage-card': undefined
    'advantage-bank': undefined
    'advantage-fees': undefined
    'notification-email': undefined
    'advantage-payments': undefined
    residence: undefined
    'advantage-rewards': undefined
    'passkey-permission': {
        handle: string
    }
    'passkey-success': undefined
    'advantage-control': undefined
    'notification-permission': undefined
    'add-wallets': undefined
    success: undefined
    'contact-info': undefined
    'join-beta': undefined
    'sign-test-transaction': undefined
}

export interface StepComponentProps {
    /** Resolved arrival direction, including browser history navigation. */
    entryDirection?: number
    onComplete?: () => void
    handle?: string
}

export interface ISetupStep {
    screenId: ScreenId
    layoutType: LayoutType
    image: SetupIllustration
    /** Full-page checklist or final confirmation, without the split illustration hero. */
    fullScreen?: boolean
    component: React.ComponentType<StepComponentProps>
    showBackButton?: boolean
    showSkipButton?: boolean
    /**
     * The step component renders the description itself (e.g. only on one of
     * its sub-views), so the chrome must not also render it.
     */
    descriptionInView?: boolean
    /**
     * Same contract for the title: the step renders its own <h1> per sub-view
     * (each view must keep exactly one top-level heading).
     */
    titleInView?: boolean
    imageClassName?: string
    titleClassName?: string
    contentClassName?: string
}
