import type { LoadingStates } from '@/constants/loadingStates.consts'
import type en from './messages/en.json'

export type LoadingStateKey = keyof typeof en.loadingStates

/* setLoadingState() call sites keep passing the English literals (they double
   as the LoadingStates union); only render sites translate, via
   useTranslations('loadingStates') + loadingStateKey(state). */
const KEY_BY_STATE: Record<LoadingStates, LoadingStateKey> = {
    Idle: 'idle',
    Loading: 'loading',
    'Preparing transaction': 'preparingTransaction',
    'Approve transaction': 'approveTransaction',
    'Sign in wallet': 'signInWallet',
    'Executing transaction': 'executingTransaction',
    'Allow network switch': 'allowNetworkSwitch',
    'Creating link': 'creatingLink',
    'Switching network': 'switchingNetwork',
    'Fetching route': 'fetchingRoute',
    'Fetching details': 'fetchingDetails',
    'Awaiting route fulfillment': 'awaitingRouteFulfillment',
    'Asserting values': 'assertingValues',
    'Generating details': 'generatingDetails',
    'Estimating points': 'estimatingPoints',
    'Getting deposit details': 'gettingDepositDetails',
    'Getting KYC status': 'gettingKycStatus',
    'Awaiting TOS confirmation': 'awaitingTosConfirmation',
    'Awaiting KYC confirmation': 'awaitingKycConfirmation',
    'Linking IBAN': 'linkingIban',
    'Linking account': 'linkingAccount',
    'Submitting Offramp': 'submittingOfframp',
    'Getting profile': 'gettingProfile',
    Registering: 'registering',
    Requesting: 'requesting',
    'Logging in': 'loggingIn',
    'Logging out': 'loggingOut',
    Paying: 'paying',
    Withdrawing: 'withdrawing',
}

export function loadingStateKey(state: LoadingStates): LoadingStateKey {
    return KEY_BY_STATE[state]
}
