import passkeyPeanut from '@/animations/512x512_PNGS_ALPHA_BACKGROUND/PNGS_512_konradurban_02/PNGS_konradurban_02_17.png'
import chillPeanutAnim from '@/animations/GIF_ALPHA_BACKGORUND/512X512_ALPHA_GIF_konradurban_01.gif'
import { PEANUTMAN_MOBILE } from '@/assets'
import { ISetupStep } from '@/components/Setup/Setup.types'
import { InstallPWA, SetupPasskey, SignupStep, WelcomeStep } from '@/components/Setup/Views'

export const setupSteps: ISetupStep[] = [
    {
        screenId: 'unsupported-browser',
        layoutType: 'standard',
        title: 'Browser Not Supported',
        description: "Please open Peanut in your device's main browser (Safari, Chrome, Firefox) to continue setup.",
        image: PEANUTMAN_MOBILE,
        component: InstallPWA,
        showBackButton: false,
        showSkipButton: false,
        imageClassName: 'w-[50%] md:w-[30%] h-auto mt-16 md:mt-0',
    },
    {
        screenId: 'pwa-install',
        layoutType: 'standard',
        title: 'Install Peanut on your phone',
        description: 'Please install Peanut on your phone for the best experience!',
        image: PEANUTMAN_MOBILE,
        component: InstallPWA,
        showBackButton: false,
        showSkipButton: false,
        imageClassName: 'w-[50%] md:w-[30%] h-auto mt-16 md:mt-0',
    },
    {
        screenId: 'welcome',
        layoutType: 'welcome',
        title: 'Access Dollars Easily',
        description:
            'Peanut wallet is the easiest way to receive and spend digital dollars. Sign up to Peanut now to be the first to know about the launch and get pre-launch rewards. Be at the forefront.',
        image: chillPeanutAnim.src,
        component: WelcomeStep,
        showBackButton: false,
        showSkipButton: false,
    },
    {
        screenId: 'signup',
        layoutType: 'signup',
        title: 'Sign up',
        image: chillPeanutAnim.src,
        component: SignupStep,
        showBackButton: true,
        showSkipButton: false,
    },
    {
        screenId: 'passkey-permission',
        layoutType: 'standard',
        title: `Let's setup passkeys`,
        description: `Use your face or fingerprint to verify it's you. There's no need for a password or seed phrase!`,
        image: passkeyPeanut.src,
        component: SetupPasskey,
        showBackButton: true,
        showSkipButton: false,
        imageClassName: 'w-[55%] md:w-[35%] h-auto mt-14 md:mt-0',
    },
]
