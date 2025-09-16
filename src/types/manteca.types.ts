export interface MantecaDepositDetails {
    depositAddress: string
    depositAlias: string
    depositAmount: string
}

export enum MercadoPagoStep {
    DETAILS = 'details',
    REVIEW = 'review',
    SUCCESS = 'success',
}

export type MantecaWithdrawData = {
    amount: string
    destinationAddress: string
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
}
