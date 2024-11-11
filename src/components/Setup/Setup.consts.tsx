import { Step } from '@/components/Setup/context/SetupFlowContext'
import WelcomeStep from './Views/Welcome'
import SetupPasskey from './Views/SetupPasskey'
import SetupSuccess from './Views/Success'
import peanutClub from '@/assets/peanut/peanut-club.png'
import fingerprint from '@/assets/icons/fingerprint.png'
import eyes from '@/assets/icons/eyes.png'
import ContactInfo from './Views/ContactInfo'

import happyPeanutAnimi from '@/animations/GIF_ALPHA_BACKGORUND/512X512_ALPHA_GIF_konradurban_03.gif'
import chillPeanutAnim from '@/animations/GIF_ALPHA_BACKGORUND/512X512_ALPHA_GIF_konradurban_01.gif'

const placeAsset = (url: string) => {
    return (
        <img 
            src={url} 
            className="z-10 w-full h-full object-cover" 
        />
    )
}

const staticPeanutImage = placeAsset(peanutClub.src)

const staticPasskeyImage = (
    <div className="flex w-full h-auto max-w-[300px] md:max-w-[400px] flex-col items-center justify-center">
        <img src={eyes.src} className="w-[150px] md:w-[200px] object-contain" />
        <img src={fingerprint.src} className="animate-float mt-[30px] w-[170px] md:w-[220px] object-contain" />
    </div>
)

export const SETUP_STEPS: Step[] = [
    {
        screenId: 'welcome',
        title: 'Welcome',
        description: 'Create your brand new peanut wallet now ! Choose a handle',
        containerClassname: 'bg-blue-1/100',
        component: () => <WelcomeStep />,
        centerComponent: () => {
            return placeAsset(chillPeanutAnim.src)
        },
    },
    {
        screenId: 'passkey',
        title: 'Passkey',
        description: 'Add a passkey to secure your wallet',
        containerClassname: 'bg-yellow-1/100',
        component: () => <SetupPasskey />,
        centerComponent: () => {
            return staticPasskeyImage
        },
    },
    {
        screenId: 'contact-info',
        title: 'Contact',
        description: 'Add your contact info to make it easier for us to reach you !',
        containerClassname: 'bg-purple-1/100',
        component: () => <ContactInfo />,
        centerComponent: () => {
            return placeAsset(chillPeanutAnim.src)
        },
    },
    {
        screenId: 'success',
        title: 'Success',
        description: "You're all set up! Let's get started",
        containerClassname: 'bg-green-1/100',
        component: () => <SetupSuccess />,
        centerComponent: () => {
            return placeAsset(happyPeanutAnimi.src)
        },
    },
]
