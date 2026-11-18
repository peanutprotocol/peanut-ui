export type ScreenId =
    | 'landing'
    | 'welcome'
    | 'invite'
    | 'signup'
    | 'passkey'
    | 'advantage-card'
    | 'advantage-bank'
    | 'advantage-fees'
    | 'notification-email'
    | 'advantage-payments'
    | 'residence'
    | 'payment-plan'
    | 'advantage-rewards'
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
    passkey: undefined
    'advantage-card': undefined
    'advantage-bank': undefined
    'advantage-fees': undefined
    'notification-email': undefined
    'advantage-payments': undefined
    residence: undefined
    'advantage-rewards': undefined
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
    component: React.ComponentType<StepComponentProps>
    showBackButton?: boolean
}
