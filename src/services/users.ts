import {
    PEANUT_API_URL,
    PEANUT_WALLET_CHAIN,
    PEANUT_WALLET_TOKEN,
    PEANUT_WALLET_TOKEN_DECIMALS,
    PEANUT_WALLET_TOKEN_SYMBOL,
} from '@/constants'
import { AccountType } from '@/interfaces'
import { IAttachmentOptions } from '@/redux/types/send-flow.types'
import { fetchWithSentry } from '@/utils'
import { interfaces as peanutInterfaces } from '@squirrel-labs/peanut-sdk'
import { chargesApi } from './charges'
import { TCharge } from './services.types'
import Cookies from 'js-cookie'

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
    totalUsdSentToCurrentUser: string
    totalUsdReceivedFromCurrentUser: string
    kycStatus: string
}

export type RecentUser = Pick<ApiUser, 'userId' | 'username' | 'fullName' | 'kycStatus'>

export interface UserSearchResponse {
    users: Array<ApiUser>
}

export const usersApi = {
    getByUsername: async (username: string): Promise<ApiUser> => {
        const response = await fetchWithSentry(`${PEANUT_API_URL}/users/username/${username}`, {
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${Cookies.get('jwt-token')}`,
            },
        })
        return await response.json()
    },

    getInteractionStatus: async (userIds: string[]): Promise<Record<string, boolean>> => {
        // returns a map of userIds to booleans indicating if the current user has sent money to them
        const response = await fetchWithSentry(`${PEANUT_API_URL}/users/interaction-status`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${Cookies.get('jwt-token')}`,
            },
            body: JSON.stringify({ userIds }),
        })
        return await response.json()
    },

    search: async (query: string): Promise<UserSearchResponse> => {
        if (query.length < 3) throw new Error('Search query must be at least 3 characters')
        const response = await fetchWithSentry(`${PEANUT_API_URL}/users/search?q=${query}`)
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
            baseUrl: window.location.origin,
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
