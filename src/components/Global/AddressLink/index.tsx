import { printableAddress, isCryptoAddress } from '@/utils/general.utils'
import { normalizeEnsName } from '@/utils/ens.utils'
import { usePrimaryNameServer } from '@/hooks/usePrimaryNameServer'
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
    const { primaryName: ensName } = usePrimaryNameServer(isAddress(address) ? address : undefined)

    useEffect(() => {
        const normalizedEnsName = isAddress(address) ? normalizeEnsName(ensName) : null
        if (normalizedEnsName) {
            setDisplayAddress(normalizedEnsName)
            setUrlAddress(normalizedEnsName)
        } else {
            setDisplayAddress(isCryptoAddress(address) ? printableAddress(address) : address)
            // keep the link target in sync — a cached/evicted ens name must not
            // leave the href pointing at a name this address may no longer own
            setUrlAddress(address)
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
