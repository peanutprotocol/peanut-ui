import EmailStep from './Views/Email'
import NotificationsStep from './Views/Notifications'
import CompleteSignupStep from './Views/CompleteSignup'
import InviteStep from './Views/Invite'
import PaymentPlanStep from './Views/PaymentPlan'
import type { ISetupStep } from '@/components/Setup/Setup.types'
import { AdvantageStep, SignupStep, LandingStep, ResidenceStep } from '@/components/Setup/Views'

export const setupSteps: ISetupStep[] = [
    {
        screenId: 'landing',
        layoutType: 'signup',
        image: { pose: 'waving-chill' },
        component: LandingStep,
        showBackButton: false,
        contentClassName: 'flex flex-col justify-between gap-8',
    },
    {
        screenId: 'signup',
        layoutType: 'signup',
        image: { pose: 'thinking' },
        component: SignupStep,
        showBackButton: true,
        contentClassName: 'flex flex-col items-end gap-6 md:justify-center',
    },
    // Asked right after registration, so a new user claims their own username first and
    // the inviter is accepted on the spot. Hidden when the signup already carries an invite.
    {
        screenId: 'invite',
        layoutType: 'signup',
        image: { animation: 'invite' },
        component: InviteStep,
        showBackButton: true,
        contentClassName: 'flex flex-col items-end gap-6 md:justify-center',
    },
    // The sell screens come before residence is asked, so they follow the country the
    // signup signals suggest (filterSetupSteps.ts); residence then confirms it.
    {
        screenId: 'advantage-fees',
        layoutType: 'signup',
        image: { animation: 'accounts' },
        component: AdvantageStep,
        showBackButton: true,
        titleSize: 'm',
        contentClassName: 'flex flex-col gap-6 md:justify-center',
    },
    {
        screenId: 'advantage-card',
        layoutType: 'signup',
        image: { animation: 'card' },
        component: AdvantageStep,
        showBackButton: true,
        titleSize: 'm',
        descriptionInTitle: true,
        contentClassName: 'flex flex-col gap-6 md:justify-center',
    },
    {
        screenId: 'residence',
        layoutType: 'signup',
        image: { animation: 'residence' },
        component: ResidenceStep,
        showBackButton: true,
        // The heading is the sentence that holds the two country pickers, so the step renders it.
        titleInView: true,
        descriptionInView: true,
        contentClassName: 'flex flex-col gap-6 md:justify-center',
    },
    {
        screenId: 'payment-plan',
        layoutType: 'signup',
        image: { animation: 'add-money' },
        component: PaymentPlanStep,
        showBackButton: true,
        // The plan's heading holds the two pickers, so the step renders it.
        titleInView: true,
        descriptionInView: true,
        contentClassName: 'flex flex-col gap-6 md:justify-center',
    },
    {
        screenId: 'notification-email',
        layoutType: 'signup',
        image: { animation: 'email' },
        component: EmailStep,
        showBackButton: true,
        contentClassName: 'flex flex-col gap-6 md:justify-center',
    },
    {
        screenId: 'notification-permission',
        layoutType: 'signup',
        image: { animation: 'notifications' },
        component: NotificationsStep,
        showBackButton: true,
        // The two-line title breaks after "notifications" instead of leaving the last words alone.
        titleClassName: 'text-balance',
        contentClassName: 'flex flex-col gap-6 md:justify-center',
    },
    {
        screenId: 'advantage-control',
        layoutType: 'signup',
        image: { animation: 'finish' },
        component: CompleteSignupStep,
        // The confirmation and the celebration share this step; each renders its own heading.
        titleInView: true,
        descriptionInView: true,
        showBackButton: true,
        contentClassName: 'flex flex-col gap-6 md:justify-center',
    },
]

/**
 * The unfiltered setup order used while the layout resolves runtime filters.
 * Derive it from the component registry so screen order has one owner.
 */
export const setupScreenIds = setupSteps.map((step) => step.screenId)
