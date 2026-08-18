import type { MascotPose } from '@/components/Global/PeanutMascot/PeanutMascot.types'

/** A setup screen leads with either a still image (its URL) or an animated mascot pose. */
export type SetupIllustration = { src: string } | { pose: MascotPose }

export type ScreenId =
    | 'landing'
    | 'welcome'
    | 'signup'
    | 'passkey-permission'
    | 'passkey-success'
    | 'notification-permission'
    | 'pwa-install'
    | 'android-initial-pwa-install'
    | 'add-wallets'
    | 'success'
    | 'unsupported-browser'
    | 'join-beta'
    | 'sign-test-transaction'

export type LayoutType = 'signup' | 'standard' | 'android-initial-pwa-install'

export type ScreenProps = {
    landing: undefined
    welcome: undefined
    signup: undefined
    'passkey-permission': {
        handle: string
    }
    'passkey-success': undefined
    'notification-permission': undefined
    'add-wallets': undefined
    success: undefined
    'contact-info': undefined
    'pwa-install': undefined
    'android-initial-pwa-install': undefined
    'unsupported-browser': undefined
    'join-beta': undefined
    'sign-test-transaction': undefined
}

export interface StepComponentProps {
    handle?: string
    deferredPrompt?: BeforeInstallPromptEvent | null
    canInstall?: boolean
}

export interface ISetupStep {
    screenId: ScreenId
    layoutType: LayoutType
    image: SetupIllustration
    component: React.ComponentType<StepComponentProps>
    showBackButton?: boolean
    showSkipButton?: boolean
    imageClassName?: string
    titleClassName?: string
    contentClassName?: string
}

export interface BeforeInstallPromptEvent extends Event {
    readonly platforms: Array<string>
    readonly userChoice: Promise<{
        outcome: 'accepted' | 'dismissed'
        platform: string
    }>
    prompt(): Promise<void>
}
