import { CreateScreens } from '../Create/Create.consts'
import * as views from './Components'
import { interfaces as peanutInterfaces } from '@squirrel-labs/peanut-sdk'
import * as consts from '@/constants'
export type CashoutScreens = 'INITIAL' | 'CONFIRM' | 'SUCCESS'

export type CashoutType = 'bank_transfer' | undefined

export interface ICashoutScreenState {
    screen: CashoutScreens
    idx: number
}

export const INIT_VIEW_STATE: ICashoutScreenState = {
    screen: 'INITIAL',
    idx: 0,
}

export const CASHOUT_SCREEN_FLOW: CashoutScreens[] = ['INITIAL', 'CONFIRM', 'SUCCESS']

export const CASHOUT_SCREEN_MAP: { [key in CashoutScreens]: { comp: React.FC<any> } } = {
    INITIAL: { comp: views.InitialCashoutView },
    CONFIRM: { comp: views.ConfirmCashoutView },
    SUCCESS: { comp: views.CashoutSuccessView },
}

export interface ICashoutScreenProps {
    onPrev: () => void
    onNext: () => void
    onCustom: (screen: CreateScreens) => void
    tokenValue: string | undefined
    setTokenValue: (value: string | undefined) => void
    recipient: { address: string | undefined; name: string | undefined }
    setRecipient: (recipient: { address: string | undefined; name: string | undefined }) => void
    usdValue: string | undefined
    setUsdValue: (value: string | number) => void
    preparedCreateLinkWrapperResponse:
        | {
              type: string
              response: any
              linkDetails: peanutInterfaces.IPeanutLinkDetails
              password: string
              feeOptions?: any
              usdValue?: string
          }
        | undefined
    setPreparedCreateLinkWrapperResponse: (
        response:
            | {
                  type: string
                  response: any
                  linkDetails: peanutInterfaces.IPeanutLinkDetails
                  password: string
                  feeOptions?: any
                  usdValue?: string
              }
            | undefined
    ) => void
    initialKYCStep: number
    setInitialKYCStep: (step: number) => void
    offrampForm: consts.IOfframpForm
    setOfframpForm: (form: consts.IOfframpForm) => void
    transactionHash: string
    setTransactionHash: (hash: string) => void
    crossChainDetails: []
}
