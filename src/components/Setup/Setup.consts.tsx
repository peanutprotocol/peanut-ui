import EmailStep from './Views/Email'
import NotificationsStep from './Views/Notifications'
import CompleteSignupStep from './Views/CompleteSignup'
import FundingStep from './Views/Funding'
import type { ISetupStep } from '@/components/Setup/Setup.types'
import { AdvantageStep, SetupPasskey, SignupStep, LandingStep, ResidenceStep } from '@/components/Setup/Views'

export const setupSteps: ISetupStep[] = [
    {
        screenId: 'landing',
        layoutType: 'signup',
        image: { pose: 'waving-chill' },
        component: LandingStep,
        showBackButton: false,
        showSkipButton: false,
        contentClassName: 'flex flex-col items-center justify-start gap-3',
    },
    {
        screenId: 'signup',
        layoutType: 'signup',
        image: { pose: 'thinking' },
        component: SignupStep,
        showBackButton: true,
        showSkipButton: false,
        contentClassName: 'flex flex-col items-end gap-6 md:justify-center',
    },

    {
        screenId: 'advantage-fees',
        layoutType: 'signup',
        image: { animation: 'fees' },
        component: AdvantageStep,
        showBackButton: true,
        showSkipButton: false,
        contentClassName: 'flex flex-col gap-6 md:justify-center',
    },
    {
        screenId: 'advantage-card',
        layoutType: 'signup',
        image: { animation: 'card' },
        component: AdvantageStep,
        showBackButton: true,
        showSkipButton: false,
        contentClassName: 'flex flex-col gap-6 md:justify-center',
    },
    {
        screenId: 'residence',
        layoutType: 'signup',
        image: { animation: 'documents' },
        component: ResidenceStep,
        showBackButton: true,
        showSkipButton: false,
        // The heads-up sub-views replace the intro copy; the select view
        // renders the title and description itself.
        descriptionInView: true,
        titleInView: true,
        contentClassName: 'flex flex-col items-end gap-6 md:justify-center',
    },
    {
        screenId: 'advantage-bank',
        layoutType: 'signup',
        image: { animation: 'bank' },
        component: AdvantageStep,
        showBackButton: true,
        showSkipButton: false,
        contentClassName: 'flex flex-col gap-6 md:justify-center',
    },

    {
        screenId: 'funding-methods',
        layoutType: 'signup',
        fullScreen: true,
        titleInView: true,
        descriptionInView: true,
        image: { pose: 'thinking' },
        component: FundingStep,
        showBackButton: true,
        contentClassName: 'flex flex-col gap-6',
    },
    {
        screenId: 'passkey-permission',
        layoutType: 'signup',
        image: { animation: 'security' },
        component: SetupPasskey,
        showBackButton: true,
        showSkipButton: false,
        contentClassName: 'flex flex-col items-end gap-6 md:justify-center',
    },
    {
        screenId: 'notification-email',
        layoutType: 'signup',
        image: { animation: 'email' },
        component: EmailStep,
        showBackButton: false,
        showSkipButton: false,
        contentClassName: 'flex flex-col gap-6 md:justify-center',
    },
    {
        screenId: 'notification-permission',
        layoutType: 'signup',
        image: { animation: 'notifications' },
        component: NotificationsStep,
        // Later mailbox changes use Profile verification.
        showBackButton: false,
        showSkipButton: false,
        contentClassName: 'flex flex-col gap-6 md:justify-center',
    },
    {
        screenId: 'advantage-control',
        layoutType: 'signup',
        image: { pose: 'too-cool' },
        component: AdvantageStep,
        showBackButton: true,
        showSkipButton: false,
        contentClassName: 'flex flex-col gap-6 md:justify-center',
    },
    {
        screenId: 'sign-test-transaction',
        layoutType: 'signup',
        fullScreen: true,
        titleInView: true,
        image: { pose: 'waving-chill' },
        component: CompleteSignupStep,
        showBackButton: false,
        showSkipButton: false,
        // The view renders the confirmation prompt itself.
        descriptionInView: true,
        // items-end, like every other signup step — centering this one alone
        // left its copy off the setup flow's left-aligned column.
        contentClassName: 'flex flex-col items-end gap-6 md:justify-center',
    },
]

/**
 * The unfiltered setup order used while the layout resolves runtime filters.
 * Derive it from the component registry so screen order has one owner.
 */
export const setupScreenIds = setupSteps.map((step) => step.screenId)
