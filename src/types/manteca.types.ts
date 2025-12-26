import { MantecaAccountType } from '@/constants/manteca.consts'

export interface MantecaDepositResponseData {
    id: string
    numberId: string
    externalId: string
    userId: string
    userNumberId: string
    userExternalId: string
    status: string
    type: 'RAMP_OPERATION'
    details: {
        depositAddresses: {
            BANK_TRANSFER: string
        }
        depositAddress: string
        depositAlias: string
        withdrawCostInAgainst: string
        withdrawCostInAsset: string
        price: string
        priceExpireAt: string
    }
    currentStage: number
    stages: {
        '1': {
            stageType: 'DEPOSIT'
            asset: string
            thresholdAmount: string
            useOverflow: boolean
            expireAt: string
        }
        '2': {
            stageType: string
            side: string
            type: string
            asset: string
            against: string
            assetAmount: string
            price: string
            priceCode: string
        }
        '3': {
            stageType: string
            network: string
            asset: string
            amount: string
            to: string
            destination: {
                address: string
                bankCode: string
            }
        }
    }
    creationTime: string
    updatedAt: string
}

export enum MercadoPagoStep {
    DETAILS = 'details',
    REVIEW = 'review',
    SUCCESS = 'success',
}

export type MantecaWithdrawData = {
    amount: string
    destinationAddress: string
    bankCode?: string
    accountType?: MantecaAccountType
    txHash: string
    currency: string
}

export type MantecaWithdrawResponseData = {
    id: string
    numberId: string
    userId: string
    userNumberId: string
    userExternalId: string
    status: string
    type: string
    details: {
        depositAddresses: {
            ARBITRUM: string
        }
        depositAddress: string
        depositAvailableNetworks: string[]
        withdrawCostInAgainst: string
        withdrawCostInAsset: string
        price: string
        priceExpireAt: string
    }
    currentStage: number
    stages: {
        1: {
            stageType: string
            side: string
            type: string
            asset: string
            against: string
            assetAmount: string
            price: string
            priceCode: string
        }
        2: {
            stageType: string
            asset: string
            amount: string
            to: string
            destination: {
                address: string
                bankCode: string
            }
        }
    }
    creationTime: string
    updatedAt: string
}

export type MantecaWithdrawResponse = {
    data?: MantecaWithdrawResponseData
    error?: string
    message?: string
}

export interface CreateMantecaOnrampParams {
    amount: string
    isUsdDenominated?: boolean
    currency: string
    chargeId?: string
}
