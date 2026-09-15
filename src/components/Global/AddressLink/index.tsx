import { printableAddress, isCryptoAddress } from '@/utils/general.utils'
import { normalizeEnsName } from '@/utils/ens-name.utils'
import { usePrimaryNameServer } from '@/hooks/usePrimaryNameServer'
import { isCapacitor } from '@/utils/capacitor'
import { recipientPayUrl } from '@/utils/native-routes'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import Link from 'next/link'
import { twMerge } from '@/utils/tw'
import { useEffect, useState } from 'react'
import { isAddress } from 'viem'

interface AddressLinkProps {
    address: string
    className?: string
    children?: React.ReactNode
    isLink?: boolean
    /** render as a plain underlined link with no LinkButton chrome — for use
        INSIDE a sentence or dense row, per the inline-links exception (the
        44px LinkButton hit area would overlap adjacent lines there) */
    inline?: boolean
}

const AddressLink = ({ address, className = '', isLink = true, inline = false }: AddressLinkProps) => {
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

    // All identifiers go to the recipient route — /{identifier} on web,
    // /send?recipient= on native (the catch-all is pruned there, and _blank
    // is a dead tap in the WebView).
    const url = recipientPayUrl(urlAddress)

    if (!isLink) {
        return <span className={className}>{displayAddress}</span>
    }
    if (inline) {
        return (
            <Link
                href={url}
                {...(!isCapacitor() && { target: '_blank', rel: 'noopener noreferrer' })}
                className={twMerge('cursor-pointer underline', className)}
            >
                {displayAddress}
            </Link>
        )
    }
    return (
        <LinkButton href={url} external={!isCapacitor()} className={className}>
            {displayAddress}
        </LinkButton>
    )
}

export default AddressLink
