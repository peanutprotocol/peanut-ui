import * as views from './views'
import { interfaces } from '@squirrel-labs/peanut-sdk'

export type raffleState = 'LOADING' | 'FOUND' | 'NOT_FOUND' | 'EMPTY' | 'SUCCESS' | 'TIMEOUT' | 'TOO_LATE'

export type Screens = 'INITIAL' | 'SUCCESS'

export interface IRaffleScreenState {
    screen: Screens
    idx: number
}

export interface IRaffleScreenProps {
    onNextScreen: () => void
    onCustomScreen: (screen: Screens) => void
    raffleLink: string
    setRaffleLink: (link: string) => void
    raffleInfo: interfaces.IRaffleInfo | undefined
    setRaffleInfo: (details: interfaces.IRaffleInfo | undefined) => void
    raffleClaimedInfo: interfaces.IClaimRaffleLinkResponse
    setRaffleClaimedInfo: (details: interfaces.IClaimRaffleLinkResponse | undefined) => void
    ensName: string | undefined
    setEnsName: (name: string | undefined) => void
    leaderboardInfo: interfaces.IRaffleLeaderboardEntry[] | undefined
    setLeaderboardInfo: (info: interfaces.IRaffleLeaderboardEntry[] | undefined) => void
    senderName: string | undefined
    setSenderName: (name: string | undefined) => void
    recipientName: string | undefined
    setRecipientName: (name: string | undefined) => void
    userStatus: interfaces.IUserRaffleStatus
    setUserStatus: (value: interfaces.IUserRaffleStatus) => void
}

export const INIT_VIEW: IRaffleScreenState = {
    screen: 'INITIAL',
    idx: 0,
}

export const RAFFLE_SCREEN_FLOW: Screens[] = ['INITIAL', 'SUCCESS']

export const RAFFLE_SCREEN_MAP: {
    [key in Screens]: { comp: React.FC<any> }
} = {
    INITIAL: { comp: views.RaffleInitialView },
    SUCCESS: { comp: views.RaffleSuccessView },
}
