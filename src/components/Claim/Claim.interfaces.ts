import * as interfaces from '@/interfaces'
import { interfaces as peanutInterfaces } from '@squirrel-labs/peanut-sdk'

export interface xchainDetail {
    axelarChainName?: string
    chainIconURI?: string
    chainId?: string
    chainType?: string
}

export type SquidChainWithTokens = peanutInterfaces.ISquidChain & { tokens: peanutInterfaces.ISquidToken[] }

export interface CombinedType extends interfaces.IPeanutChainDetails {
    tokens: interfaces.IToken[]
}
