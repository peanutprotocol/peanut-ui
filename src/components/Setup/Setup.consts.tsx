import EmailStep from './Views/Email'
import NotificationsStep from './Views/Notifications'
import CompleteSignupStep from './Views/CompleteSignup'
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
        contentClassName: 'flex flex-col items-center justify-start gap-8',
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
        screenId: 'advantage-card',
        layoutType: 'signup',
        image: { animation: 'card' },
        component: AdvantageStep,
        showBackButton: true,
        showSkipButton: false,
        contentClassName: 'flex flex-col gap-6 md:justify-center',
    },
    {
        screenId: 'advantage-exchange',
        layoutType: 'signup',
        image: { animation: 'exchange' },
        component: AdvantageStep,
        showBackButton: true,
        showSkipButton: false,
        contentClassName: 'flex flex-col gap-6 md:justify-center',
    },
    {
        screenId: 'advantage-local',
        layoutType: 'signup',
        image: { animation: 'local' },
        component: AdvantageStep,
        showBackButton: true,
        showSkipButton: false,
        contentClassName: 'flex flex-col gap-6 md:justify-center',
    },
    {
        screenId: 'advantage-people',
        layoutType: 'signup',
        image: { animation: 'people' },
        component: AdvantageStep,
        showBackButton: true,
        showSkipButton: false,
        contentClassName: 'flex flex-col gap-6 md:justify-center',
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
        contentClassName: 'flex flex-col gap-4 md:justify-center',
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
        component: CompleteSignupStep,
        titleInView: true,
        descriptionInView: true,
        showBackButton: false,
        showSkipButton: false,
        contentClassName: 'flex flex-col gap-6 md:justify-center',
    },
]

/**
 * The unfiltered setup order used while the layout resolves runtime filters.
 * Derive it from the component registry so screen order has one owner.
 */
export const setupScreenIds = setupSteps.map((step) => step.screenId)
