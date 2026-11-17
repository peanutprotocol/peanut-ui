import type { ISetupStep } from '@/components/Setup/Setup.types'
import { LandingScreen } from '@/components/Setup/redesign/Landing/LandingScreen'
import { AccountsScreen } from '@/components/Setup/redesign/Accounts/AccountsScreen'
import { CardScreen } from '@/components/Setup/redesign/Card/CardScreen'
import { ResidenceScreen } from '@/components/Setup/redesign/Residence/ResidenceScreen'
import { PaymentPlanScreen } from '@/components/Setup/redesign/PaymentPlan/PaymentPlanScreen'
import { UsernameScreen } from '@/components/Setup/redesign/Username/UsernameScreen'
import { InviteScreen } from '@/components/Setup/redesign/Invite/InviteScreen'
import { PasskeyScreen } from '@/components/Setup/redesign/Passkey/PasskeyScreen'
import { EmailScreen } from '@/components/Setup/redesign/Email/EmailScreen'
import { NotificationsScreen } from '@/components/Setup/redesign/Notifications/NotificationsScreen'
import { FinalStep } from '@/components/Setup/redesign/FinalConfirm/FinalStep'

/**
 * The sign-up steps in dev's order (owner ruling, 16 Nov 2026). Each screen draws its own stage, panel and footer
 * inside SetupShell; the screen ids stay as they were, so analytics, the draft, resume and the back lock read the
 * same names.
 */
export const setupSteps: ISetupStep[] = [
    { screenId: 'landing', layoutType: 'signup', component: LandingScreen, showBackButton: false },
    { screenId: 'advantage-fees', layoutType: 'signup', component: AccountsScreen, showBackButton: true },
    { screenId: 'advantage-card', layoutType: 'signup', component: CardScreen, showBackButton: true },
    { screenId: 'residence', layoutType: 'signup', component: ResidenceScreen, showBackButton: true },
    { screenId: 'payment-plan', layoutType: 'signup', component: PaymentPlanScreen, showBackButton: true },
    { screenId: 'signup', layoutType: 'signup', component: UsernameScreen, showBackButton: true },
    { screenId: 'invite', layoutType: 'signup', component: InviteScreen, showBackButton: true },
    { screenId: 'passkey', layoutType: 'signup', component: PasskeyScreen, showBackButton: true },
    { screenId: 'notification-email', layoutType: 'signup', component: EmailScreen, showBackButton: true },
    { screenId: 'notification-permission', layoutType: 'signup', component: NotificationsScreen, showBackButton: true },
    { screenId: 'advantage-control', layoutType: 'signup', component: FinalStep, showBackButton: true },
]

/**
 * The unfiltered setup order used while the layout resolves runtime filters.
 * Derive it from the component registry so screen order has one owner.
 */
export const setupScreenIds = setupSteps.map((step) => step.screenId)
