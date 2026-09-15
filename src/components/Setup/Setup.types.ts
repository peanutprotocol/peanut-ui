export type ScreenId =
    | 'landing'
    | 'welcome'
    | 'signup'
    | 'residence'
    | 'passkey-permission'
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
    residence: undefined
    'passkey-permission': {
        handle: string
    }
    'passkey-success': undefined
    'notification-permission': undefined
    'add-wallets': undefined
    success: undefined
    'contact-info': undefined
    'join-beta': undefined
    'sign-test-transaction': undefined
}

export interface StepComponentProps {
    handle?: string
}

export interface ISetupStep {
    screenId: ScreenId
    layoutType: LayoutType
    image: string
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
