import WelcomeStep from './Views/Welcome'
import SetupPasskey from './Views/SetupPasskey'
import SetupSuccess from './Views/Success'
import fingerprint from '@/assets/icons/fingerprint.png'
import eyes from '@/assets/icons/eyes.png'
import ContactInfo from './Views/ContactInfo'

import happyPeanutAnim from '@/animations/GIF_ALPHA_BACKGORUND/512X512_ALPHA_GIF_konradurban_03.gif'
import chillPeanutAnim from '@/animations/GIF_ALPHA_BACKGORUND/512X512_ALPHA_GIF_konradurban_01.gif'
import { Step } from './Setup.types'
import InstallPWA from './Views/InstallPWA'
import { peanutWalletIsInPreview } from '@/constants'
import NotificationPermission from './Views/NotificationPermission'

const placeAsset = (url: string) => {
    return <img src={url} className="z-10 h-full w-[300px] object-contain" />
}

export const SETUP_STEPS = [
    {
        screenId: 'welcome',
        active: true,
        title: 'HENLOOO!',
        description: "We're cooking. Pre-register now and claim juicy rewards for peanut OGs like you.",
        containerClassname: 'bg-blue-1/100',
        component: () => <WelcomeStep />,
        centerComponent: () => {
            return placeAsset(chillPeanutAnim.src)
        },
    },
    {
        screenId: 'passkey',
        active: true,
        title: 'PASSKEY',
        description: 'Secure your account with your DNA',
        containerClassname: 'bg-yellow-1/100',
        component: () => <SetupPasskey />,
        centerComponent: () => {
            return (
                <div className="flex h-full w-2/3 flex-col items-center justify-center md:max-w-[400px]">
                    <img src={eyes.src} className="w-full object-contain md:w-[200px]" />
                    <img src={fingerprint.src} className="mt-[40px] w-full object-contain md:w-[220px]" />
                </div>
            )
        },
    },
    {
        screenId: 'contact-info',
        active: peanutWalletIsInPreview,
        title: 'CONTACT',
        description: "We're cooking. Share your contact so we can share rewards for early OGs",
        containerClassname: 'bg-purple-1/100',
        component: () => <ContactInfo />,
        centerComponent: () => {
            return placeAsset(chillPeanutAnim.src)
        },
    },
    {
        screenId: 'pwa-install',
        active: peanutWalletIsInPreview,
        title: 'INSTALL',
        description: 'Install Peanut on your phone for best UX and a lil bonus',
        containerClassname: 'bg-blue-1/100 text-black',
        component: () => <InstallPWA />,
        centerComponent: () => {
            return placeAsset(chillPeanutAnim.src)
        },
    },
    {
        screenId: 'noficiation-permission',
        active: true, // disable for now since not working
        title: 'NOTIFICATIONS',
        description: 'We will only send one notification. You want to be ready :)',
        containerClassname: 'bg-blue-1/100',
        component: () => <NotificationPermission />,
        centerComponent: () => {
            return placeAsset(chillPeanutAnim.src)
        },
    },
    {
        screenId: 'success',
        active: true,
        title: 'SUCCESS',
        description: 'Grab a drink and enjoy payments day',
        containerClassname: 'bg-purple-1/100',
        component: () => <SetupSuccess />,
        centerComponent: () => {
            return placeAsset(happyPeanutAnim.src)
        },
    },
].filter((step) => step.active) as Step[]
