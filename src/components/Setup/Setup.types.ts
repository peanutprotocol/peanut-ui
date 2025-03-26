export type ScreenId =
    | 'welcome'
    | 'signup'
    | 'passkey-permission'
    | 'passkey-success'
    | 'notification-permission'
    | 'pwa-install'
    | 'add-wallets'
    | 'success'

export type LayoutType = 'welcome' | 'signup' | 'standard'

export type ScreenProps = {
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
}

export interface StepComponentProps {
    handle?: string
    deferredPrompt?: BeforeInstallPromptEvent | null
    canInstall?: boolean
}

export interface ISetupStep {
    screenId: ScreenId
    layoutType: LayoutType
    title: string
    description?: string
    image: string
    component: React.ComponentType<StepComponentProps>
    showBackButton?: boolean
    showSkipButton?: boolean
    imageClassName?: string
}

export interface BeforeInstallPromptEvent extends Event {
    readonly platforms: Array<string>
    readonly userChoice: Promise<{
        outcome: 'accepted' | 'dismissed'
        platform: string
    }>
    prompt(): Promise<void>
}
