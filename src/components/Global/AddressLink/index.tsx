import { printableAddress } from '@/utils'
import { usePrimaryName } from '@justaname.id/react'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { isAddress } from 'viem'

interface AddressLinkProps {
    address: string
    className?: string
    children?: React.ReactNode
}

const AddressLink = ({ address, className = '' }: AddressLinkProps) => {
    const [displayAddress, setDisplayAddress] = useState<string>(
        isAddress(address) ? printableAddress(address) : address
    )
    const [urlAddress, setUrlAddress] = useState<string>(address)

    // Look up ENS name only for Ethereum addresses
    const { primaryName: ensName } = usePrimaryName({
        address: isAddress(address) ? (address as `0x${string}`) : undefined,
        chainId: 1, // Mainnet for ENS lookups
        priority: 'onChain',
    })

    useEffect(() => {
        // Update display: prefer ENS name for addresses, otherwise use as-is
        if (isAddress(address) && ensName) {
            // for peanut ens names, strip the domain from the displayed string so its just a username (no ens subdomain)
            const peanutEnsDomain = process.env.NEXT_PUBLIC_JUSTANAME_ENS_DOMAIN || ''
            const normalizedEnsName = ensName.replace(peanutEnsDomain, '').replace(/\.$/, '')

            setDisplayAddress(normalizedEnsName)
            setUrlAddress(normalizedEnsName)
        } else {
            setDisplayAddress(isAddress(address) ? printableAddress(address) : address)
        }
    }, [address, ensName])

    // Create a simple URL - all identifiers go to /{identifier}
    const url = `/${urlAddress}`

    return (
        <Link className={twMerge('cursor-pointer text-xs text-grey-1 underline', className)} href={url} target="_blank">
            {displayAddress}
        </Link>
    )
}

export default AddressLink
