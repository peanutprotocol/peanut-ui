import * as interfaces from '@/interfaces'

export interface CombinedType extends interfaces.IPeanutChainDetails {
    tokens: interfaces.IToken[]
}

export interface TokenSelectorProps {
    classNameButton?: string
    simpleButton?: boolean
}

export interface TokenSelectorXChainProps extends TokenSelectorProps {
    data?: CombinedType[]
}
