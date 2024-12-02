import peanut from '@squirrel-labs/peanut-sdk'

import { peanutTokenDetails } from '@/constants'
import { IUserBalance } from '@/interfaces'
import { areEvmAddressesEqual, isNativeCurrency } from '@/utils'

const convertUSDTokenValue = ({ tokenValue, tokenPrice }: { tokenValue: number; tokenPrice: number }) => {
    return tokenValue / tokenPrice
}

export const isGaslessDepositPossible = ({
    tokenAddress,
    latestContractVersion,
    chainId,
}: {
    tokenAddress: string
    latestContractVersion?: string
    chainId: string
}) => {
    if (latestContractVersion == undefined) {
        latestContractVersion = peanut.getLatestContractVersion({
            chainId: chainId,
            type: 'normal',
        })
    }
    if (
        toLowerCaseKeys(peanut.EIP3009Tokens[chainId as keyof typeof peanut.EIP3009Tokens])[
            tokenAddress.toLowerCase()
        ] &&
        peanut.VAULT_CONTRACTS_WITH_EIP_3009.includes(latestContractVersion)
    ) {
        return true
    } else {
        return false
    }
}

function toLowerCaseKeys(obj: any): any {
    let newObj: any = {}
    if (obj) {
        Object.keys(obj).forEach((key) => {
            // Convert only the top-level keys to lowercase
            let lowerCaseKey = key.toLowerCase()
            newObj[lowerCaseKey] = obj[key]
        })
    }

    return newObj
}

export const getTokenDetails = (tokenAddress: string, chainId: string, userBalances: IUserBalance[]) => {
    let tokenDecimals: number = 18
    if (
        userBalances.some(
            (balance) => areEvmAddressesEqual(balance.address, tokenAddress) && balance.chainId === chainId
        )
    ) {
        tokenDecimals =
            userBalances.find(
                (balance) => balance.chainId === chainId && areEvmAddressesEqual(balance.address, tokenAddress)
            )?.decimals ?? 18
    } else {
        tokenDecimals =
            peanutTokenDetails
                .find((detail) => detail.chainId.toString() == chainId)
                ?.tokens.find((token) => areEvmAddressesEqual(token.address, tokenAddress))?.decimals ?? 18
    }
    const tokenType = isNativeCurrency(tokenAddress) ? 0 : 1

    return { tokenDecimals, tokenType }
}
