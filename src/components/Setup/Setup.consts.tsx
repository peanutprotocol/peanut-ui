import passkeyPeanut from '@/animations/512x512_PNGS_ALPHA_BACKGROUND/PNGS_512_konradurban_02/PNGS_konradurban_02_17.png'
import successPeanut from '@/animations/512x512_PNGS_ALPHA_BACKGROUND/PNGS_512_konradurban_03/PNGS_konradurban_03_46.png'
import notificationPeanut from '@/animations/512x512_PNGS_ALPHA_BACKGROUND/PNGS_512_konradurban_06/PNGS_konradurban_06_11.png'
import chillPeanutAnim from '@/animations/GIF_ALPHA_BACKGORUND/512X512_ALPHA_GIF_konradurban_01.gif'
import { ISetupStep } from '@/components/Setup/Setup.types'
import {
    AddWallets,
    InstallPWA,
    NotificationPermission,
    PasskeySuccess,
    SetupPasskey,
    SetupSuccess,
    SignupStep,
    WelcomeStep,
} from '@/components/Setup/Views'

export const setupSteps: ISetupStep[] = [
    {
        screenId: 'welcome',
        layoutType: 'welcome',
        title: 'Access Dollars Easily',
        description: 'Peanut wallet is the easiest way to receive and spend digital dollars.',
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
        description: `Use your face or fingerprint to verify it's you. There's no need for a password.`,
        image: passkeyPeanut.src,
        component: SetupPasskey,
        showBackButton: true,
        showSkipButton: false,
    },
    {
        screenId: 'passkey-success',
        layoutType: 'standard',
        title: `Your Passkey is already setup now`,
        description: `Use your face or fingerprint to verify it's you. There's no need for a password.`,
        // todo: replace with image from design
        image: 'https://s3-alpha-sig.figma.com/img/e086/9fce/1967d88a6e8f75c882240879eb14c23e?Expires=1736121600&Key-Pair-Id=APKAQ4GOSFWCVNEHN3O4&Signature=YGygvtcricxKOAZOdua2jxq-oz46RuV~haLYJUTAqRl7eVE6j9kMF6Uhub~HmfpWAbHaE6ek~2WkB-NVyVeAKlq~9qg-YICB8upWECQrNj0MwQ0EKY4~3e~oW-EIEP5OmA~-6xrlzlLpuK8xYz5eMcJAsNdlbxzLTWpfO-En2UOGMlCrrXjwoxqNjQDSyOruOyAFjtxDRh-bd5qVnZUJddjj5LPs7q4HvmemzFFi0i4JP5dyzWG6x7zGzMCHZ-gLqS-ZQTAqFJYqCbHgHgnMswOrgFFoaJeoGXFhHBd6OuBNaies4iI5xUDF5rYC-N0BaP-2jWK0lyHoa-Ry2VXk8A__',
        component: PasskeySuccess,
        showBackButton: true,
        showSkipButton: false,
    },
    {
        screenId: 'notification-permission',
        layoutType: 'standard',
        title: 'Enable notification',
        description: 'Get notified about incoming and outgoing of payments.',
        image: notificationPeanut.src,
        component: NotificationPermission,
        showBackButton: true,
        showSkipButton: true,
    },
    {
        screenId: 'pwa-install',
        layoutType: 'standard',
        title: 'Install Peanut wallet App in your phone',
        description: 'You can directly use app from Homescreen on your phone.',
        // todo: replace with image from design
        image: passkeyPeanut.src,
        component: InstallPWA,
        showBackButton: true,
        showSkipButton: true,
    },
    {
        screenId: 'add-wallets',
        layoutType: 'standard',
        title: 'Add extra wallet',
        description: 'Have another wallet? Add it here to keep everything in one place.',
        // todo: replace with image from design
        image: passkeyPeanut.src,
        component: AddWallets,
        showBackButton: true,
        showSkipButton: true,
    },
    {
        screenId: 'success',
        layoutType: 'standard',
        title: `You're all set!`,
        description: 'Start using Peanut for payments.',
        image: successPeanut.src,
        component: SetupSuccess,
        showBackButton: true,
        showSkipButton: false,
    },
]
