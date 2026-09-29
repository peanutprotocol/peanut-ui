import { useQuery } from '@tanstack/react-query'
import { mantecaApi } from '@/services/manteca'

/**
 * One cache entry per PIX key, shared by the key screen (which resolves the key
 * on Continue) and /qr-pay (which shows the owner), so a payment costs one
 * lookup. Each lookup spends a directory quota that Brazil caps for lookups no
 * payment follows, so nothing retries or refetches on its own.
 */
export const pixKeyOwnerQueryOptions = (pixKey: string) => ({
    queryKey: ['pix-key-owner', pixKey] as const,
    queryFn: () => mantecaApi.getPixKeyOwner(pixKey),
    staleTime: 10 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: false,
    retryOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
})

/** The owner of `pixKey`, or no data while the key is unknown or the lookup failed. */
export const usePixKeyOwner = (pixKey: string | null) =>
    useQuery({ ...pixKeyOwnerQueryOptions(pixKey ?? ''), enabled: !!pixKey })
