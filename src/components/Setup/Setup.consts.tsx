import {
    PEANUTMAN_MOBILE,
    PeanutPointing,
    PeanutThinking,
    PeanutTooCool,
    PeanutWavingHello,
    PeanutWhistling,
} from '@/assets/mascot'
import type { ISetupStep } from '@/components/Setup/Setup.types'
import {
    InstallPWA,
    SetupPasskey,
    SignupStep,
    LandingStep,
    ResidenceStep,
    SignTestTransaction,
} from '@/components/Setup/Views'
import JoinWaitlist from './Views/JoinWaitlist'

export const setupSteps: ISetupStep[] = [
    {
        screenId: 'unsupported-browser',
        layoutType: 'standard',
        image: PEANUTMAN_MOBILE.src,
        component: InstallPWA,
        showBackButton: false,
        showSkipButton: false,
        imageClassName: 'w-[50%] md:w-[30%] h-auto mt-16 md:mt-0',
    },
    {
        screenId: 'android-initial-pwa-install',
        layoutType: 'android-initial-pwa-install',
        image: PEANUTMAN_MOBILE.src,
        component: InstallPWA,
        showBackButton: false,
        showSkipButton: false,
        showLoginButton: false,
        imageClassName: 'w-[50%] md:w-[30%] h-auto',
        titleClassName: 'text-heading-s',
        contentClassName: 'flex flex-col items-center justify-center gap-6',
    },
    {
        screenId: 'pwa-install',
        layoutType: 'standard',
        image: PEANUTMAN_MOBILE.src,
        component: InstallPWA,
        showBackButton: false,
        showSkipButton: true,
        showLoginButton: false,
        imageClassName: 'w-[50%] md:w-[30%] h-auto mt-16 md:mt-0',
    },
    {
        screenId: 'landing',
        layoutType: 'signup',
        image: PeanutWhistling.src,
        component: LandingStep,
        showBackButton: false,
        showSkipButton: false,
        contentClassName: 'flex flex-col items-center justify-center gap-6',
    },
    {
        screenId: 'welcome',
        layoutType: 'signup',
        image: PeanutPointing.src,
        component: JoinWaitlist,
        showBackButton: true,
        showSkipButton: false,
        showLoginButton: true,
        contentClassName: 'flex flex-col items-center justify-center gap-6',
    },
    {
        screenId: 'signup',
        layoutType: 'signup',
        image: PeanutThinking.src,
        component: SignupStep,
        showBackButton: true,
        showSkipButton: false,
        showLoginButton: true,
        contentClassName: 'flex flex-col items-end pt-8 justify-center gap-6',
    },
    {
        screenId: 'residence',
        layoutType: 'signup',
        image: PeanutWavingHello.src,
        component: ResidenceStep,
        showBackButton: true,
        showSkipButton: false,
        // The heads-up sub-views replace the intro copy; the select view
        // renders the title and description itself.
        descriptionInView: true,
        titleInView: true,
        contentClassName: 'flex flex-col items-end pt-8 justify-center gap-6',
    },
    {
        screenId: 'passkey-permission',
        layoutType: 'signup',
        image: PeanutTooCool.src,
        component: SetupPasskey,
        showBackButton: true,
        showSkipButton: false,
        contentClassName: 'flex flex-col items-end pt-8 justify-center gap-6',
    },
    {
        screenId: 'sign-test-transaction',
        layoutType: 'signup',
        image: PeanutWhistling.src,
        component: SignTestTransaction,
        showBackButton: false,
        showSkipButton: false,
        // The view renders the description itself: the confirm prompt before
        // signing, the account-ready celebration after.
        descriptionInView: true,
        // items-end, like every other signup step — centering this one alone
        // left its copy off the setup flow's left-aligned column.
        contentClassName: 'flex flex-col items-end pt-8 justify-center gap-6',
    },
]
