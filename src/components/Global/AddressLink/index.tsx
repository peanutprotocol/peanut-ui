import { printableAddress, isCryptoAddress } from '@/utils/general.utils'
import { usePrimaryName } from '@justaname.id/react'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { isAddress } from 'viem'

interface AddressLinkProps {
    address: string
    className?: string
    children?: React.ReactNode
    isLink?: boolean
}

const AddressLink = ({ address, className = '', isLink = true }: AddressLinkProps) => {
    const [displayAddress, setDisplayAddress] = useState<string>(
        isCryptoAddress(address) ? printableAddress(address) : address
    )
    const [urlAddress, setUrlAddress] = useState<string>(address)

    // Look up ENS name only for Ethereum addresses (ENS doesn't apply to Solana/Tron)
    const { primaryName: ensName } = usePrimaryName({
        address: isAddress(address) ? (address as `0x${string}`) : undefined,
        chainId: 1, // Mainnet for ENS lookups
        priority: 'onChain',
    })

    useEffect(() => {
        // Update display: prefer ENS name for EVM addresses, otherwise shorten any crypto address
        if (isAddress(address) && ensName) {
            // for peanut ens names, strip the domain from the displayed string so its just a username (no ens subdomain)
            const peanutEnsDomain = process.env.NEXT_PUBLIC_JUSTANAME_ENS_DOMAIN || ''
            const normalizedEnsName = ensName.replace(peanutEnsDomain, '').replace(/\.$/, '')

            setDisplayAddress(normalizedEnsName)
            setUrlAddress(normalizedEnsName)
        } else {
            setDisplayAddress(isCryptoAddress(address) ? printableAddress(address) : address)
        }
    }, [address, ensName])

    // Create a simple URL - all identifiers go to /{identifier}
    const url = `/${urlAddress}`

    return isLink ? (
        <Link className={twMerge('cursor-pointer text-xs text-grey-1 underline', className)} href={url} target="_blank">
            {displayAddress}
        </Link>
    ) : (
        <span className={className}>{displayAddress}</span>
    )
}

export default AddressLink
