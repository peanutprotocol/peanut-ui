import {
    PEANUT_WALLET_CHAIN,
    PEANUT_WALLET_TOKEN,
    PEANUT_WALLET_TOKEN_DECIMALS,
    PEANUT_WALLET_TOKEN_SYMBOL,
} from '@/constants/zerodev.consts'
import { AccountType, type IUserKycVerification } from '@/interfaces'
import { type IAttachmentOptions } from '@/interfaces/attachment'
import { serverFetch } from '@/utils/api-fetch'
import { interfaces as peanutInterfaces } from '@squirrel-labs/peanut-sdk'
import { chargesApi } from './charges'
import { type TCharge } from './services.types'
import { BASE_URL } from '@/constants/general.consts'

type ApiAccount = {
    identifier: string
    type: AccountType
}

export type ApiUser = {
    userId: string
    username: string
    accounts: ApiAccount[]
    fullName: string
    firstName: string
    lastName: string
    showFullName?: boolean
    totalUsdSentToCurrentUser: string
    totalUsdReceivedFromCurrentUser: string
    bridgeKycStatus: string
    kycVerifications?: IUserKycVerification[]
    badges?: Array<{
        code: string
        name: string
        description: string | null
        iconUrl: string | null
        color?: string | null
        earnedAt?: string
    }>
}

export type RecentUser = Pick<ApiUser, 'userId' | 'username' | 'fullName' | 'bridgeKycStatus'>

export interface UserSearchResponse {
    users: Array<ApiUser>
}

export const usersApi = {
    getByUsername: async (username: string): Promise<ApiUser> => {
        const response = await serverFetch(`/users/username/${username}`, {
            method: 'GET',
        })
        return await response.json()
    },

    getInteractionStatus: async (userIds: string[]): Promise<Record<string, boolean>> => {
        // returns a map of userIds to booleans indicating if the current user has sent money to them
        const response = await serverFetch('/users/interaction-status', {
            method: 'POST',
            body: JSON.stringify({ userIds }),
        })
        return await response.json()
    },

    requestByUsername: async ({
        username,
        amount,
        toAddress,
        attachment,
    }: {
        username: string
        amount: string
        toAddress: string
        attachment?: IAttachmentOptions
    }): Promise<TCharge> => {
        return chargesApi.create({
            pricing_type: 'fixed_price',
            local_price: { amount, currency: 'USD' },
            baseUrl: BASE_URL,
            requestId: undefined,
            requestProps: {
                chainId: PEANUT_WALLET_CHAIN.id.toString(),
                tokenAddress: PEANUT_WALLET_TOKEN,
                tokenType: peanutInterfaces.EPeanutLinkType.erc20,
                tokenSymbol: PEANUT_WALLET_TOKEN_SYMBOL,
                tokenDecimals: PEANUT_WALLET_TOKEN_DECIMALS,
                requesteeUsername: username,
                recipientAddress: toAddress,
            },
            attachment: attachment?.rawFile,
            reference: attachment?.message,
            mimeType: attachment?.rawFile?.type,
            filename: attachment?.rawFile?.name,
        })
    },
}
