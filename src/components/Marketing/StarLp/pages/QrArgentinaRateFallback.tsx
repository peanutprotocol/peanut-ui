import { SectionTitle } from '@/components/Marketing/StarLp/SectionTitle'

/**
 * The rate fold's title when there is no live rate (API down, slow, off-contract
 * or older than 30 minutes). The page never prints a rate it did not just read.
 */
export function QrArgentinaRateFallback() {
    return <SectionTitle>See the pesos before you pay.</SectionTitle>
}
