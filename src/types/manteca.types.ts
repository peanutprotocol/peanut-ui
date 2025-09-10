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
