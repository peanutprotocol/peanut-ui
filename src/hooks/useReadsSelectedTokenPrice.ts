import { useContext, useEffect } from 'react'
import { tokenSelectorContext } from '@/context/tokenSelector.context'

/**
 * Declares that the calling flow reads `selectedTokenData` from the token
 * context. The context fetches the selected token's price only while such a
 * flow is mounted (TASK-23850): a token pick anywhere else costs no
 * /tokens/price request.
 */
export function useReadsSelectedTokenPrice(): void {
    const { readTokenPrice } = useContext(tokenSelectorContext)
    useEffect(() => readTokenPrice(), [readTokenPrice])
}
