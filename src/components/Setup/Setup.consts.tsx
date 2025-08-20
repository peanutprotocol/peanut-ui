import chillPeanutAnim from '@/animations/GIF_ALPHA_BACKGORUND/512X512_ALPHA_GIF_konradurban_01.gif'
import peanutWithGlassesAnim from '@/animations/GIF_ALPHA_BACKGORUND/512X512_ALPHA_GIF_konradurban_06.gif'
import happyPeanutAnim from '@/animations/GIF_ALPHA_BACKGORUND/512X512_ALPHA_GIF_konradurban_03.gif'
import { PEANUTMAN_MOBILE, ThinkingPeanut } from '@/assets'
import { ISetupStep } from '@/components/Setup/Setup.types'
import { InstallPWA, SetupPasskey, SignupStep, WelcomeStep, JoinBetaSetp } from '@/components/Setup/Views'

export const setupSteps: ISetupStep[] = [
    {
        screenId: 'unsupported-browser',
        layoutType: 'standard',
        title: 'Browser Not Supported',
        description:
            "Please open Peanut in your device's main browser (Safari, Chrome, Firefox) to continue setup. If you are already in your main browser your device may not support Peanut.",
        image: PEANUTMAN_MOBILE,
        component: InstallPWA,
        showBackButton: false,
        showSkipButton: false,
        imageClassName: 'w-[50%] md:w-[30%] h-auto mt-16 md:mt-0',
    },
    {
        screenId: 'android-initial-pwa-install',
        layoutType: 'android-initial-pwa-install',
        title: 'Get the full experience',
        description: 'Keep your wallet one tap away. Safe, fast, and on your home screen.',
        image: PEANUTMAN_MOBILE,
        component: InstallPWA,
        showBackButton: false,
        showSkipButton: false,
        imageClassName: 'w-[50%] md:w-[30%] h-auto',
        titleClassName: 'text-2xl',
        contentClassName: 'flex flex-col items-center justify-center gap-5',
    },
    {
        screenId: 'pwa-install',
        layoutType: 'standard',
        title: 'Install Peanut on your phone',
        description: 'Please install Peanut on your phone for the best experience!',
        image: PEANUTMAN_MOBILE,
        component: InstallPWA,
        showBackButton: false,
        showSkipButton: true,
        imageClassName: 'w-[50%] md:w-[30%] h-auto mt-16 md:mt-0',
    },
    {
        screenId: 'welcome',
        layoutType: 'signup',
        title: 'Peanut makes dollars easy.',
        description: 'Create your wallet in seconds to save, send, or cash out dollars fast.',
        image: chillPeanutAnim.src,
        component: WelcomeStep,
        showBackButton: false,
        showSkipButton: false,
        contentClassName: 'flex flex-col items-center justify-center gap-5',
    },
    {
        screenId: 'signup',
        layoutType: 'signup',
        title: 'How should we call you?',
        description: "Choose your username. It'll be your ID to send and receive money.",
        image: ThinkingPeanut.src,
        component: SignupStep,
        showBackButton: true,
        showSkipButton: false,
        contentClassName: 'flex flex-col items-end pt-8 justify-center gap-5',
    },
    {
        screenId: 'join-beta',
        layoutType: 'signup',
        title: 'In for the beta program?',
        description: 'We’ll occasionally DM you on Telegram for feedback and early features.',
        image: peanutWithGlassesAnim.src,
        component: JoinBetaSetp,
        showBackButton: true,
        showSkipButton: false,
        contentClassName: 'flex flex-col items-end pt-8 justify-center gap-5',
    },
    {
        screenId: 'passkey-permission',
        layoutType: 'signup',
        title: `Let's set up your passkey`,
        description: `Use your face or fingerprint to log in. No passwords, no hassle. Just you.`,
        image: happyPeanutAnim.src,
        component: SetupPasskey,
        showBackButton: true,
        showSkipButton: false,
        contentClassName: 'flex flex-col items-end pt-8 justify-center gap-5',
    },
]
