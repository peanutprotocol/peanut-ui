import { Step } from '@/components/Setup/context/SetupFlowContext'
import WelcomeStep from './Views/Welcome'
import SetupPasskey from './Views/SetupPasskey'
import AddWallets from './Views/AddWallets'
import SetupSuccess from './Views/Success'

export const SETUP_STEPS: Step[] = [
    {
        screenId: 'welcome',
        title: 'Welcome',
        description: 'Create your brand new peanut wallet now ! Choose a handle',
        containerClassname: 'bg-blue-1/100',
        component: () => <WelcomeStep />,
    },
    {
        screenId: 'passkey',
        title: 'Passkey',
        description: 'Add a passkey to secure your wallet',
        containerClassname: 'bg-yellow-1/100',
        component: () => <SetupPasskey />,
    },
    {
        screenId: 'add-wallets',
        title: 'Add Wallets',
        description: 'Connect additional wallets. This is optional & you can add and remove wallets later',
        containerClassname: 'bg-purple-1/100',
        component: () => <AddWallets />,
    },
    {
        screenId: 'success',
        title: 'Success',
        description: "You're all set up! Let's get started",
        containerClassname: 'bg-green-1/100',
        component: () => <SetupSuccess />,
    },
]
