export const ADDRESS_ZERO = '0x0000000000000000000000000000000000000000'

export interface TokenData {
    chainId: string
    address: string
    decimals: number
}

export enum EPeanutLinkType {
    native,
    erc20,
}

export enum RequestStatus {
    LOADING = 'LOADING',
    CLAIM = 'CLAIM',
    NOT_FOUND = 'NOT_FOUND',
}
