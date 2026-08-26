'use client'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { SAVED_ADDRESSES } from '@/constants/query.consts'
import { savedAddressesApi, type SaveAddressInput } from '@/services/saved-addresses'
import { useUserStore } from '@/redux/hooks'
import type { SavedAddress } from '@/interfaces/interfaces'
import { savedAddressKey } from '@/utils/saved-address.utils'

/** The user's crypto address book, plus save / rename / remove. Every mutation refetches the list. */
export function useSavedAddresses() {
    const { user } = useUserStore()
    const queryClient = useQueryClient()
    const invalidate = () => queryClient.invalidateQueries({ queryKey: [SAVED_ADDRESSES] })

    const query = useQuery({
        queryKey: [SAVED_ADDRESSES],
        queryFn: savedAddressesApi.list,
        enabled: !!user,
        staleTime: 5 * 60 * 1000,
    })

    const save = useMutation({
        mutationFn: (input: SaveAddressInput) => savedAddressesApi.save(input),
        onSuccess: invalidate,
    })
    const rename = useMutation({
        mutationFn: ({ id, nickname }: { id: string; nickname: string }) => savedAddressesApi.rename(id, nickname),
        onSuccess: invalidate,
    })
    const remove = useMutation({
        mutationFn: (id: string) => savedAddressesApi.remove(id),
        onSuccess: invalidate,
    })

    const savedAddresses = query.data ?? []
    const findSaved = (chainId: string | number, address: string): SavedAddress | undefined => {
        const key = savedAddressKey(chainId, address)
        return savedAddresses.find((s) => savedAddressKey(s.chainId, s.address) === key)
    }

    return { savedAddresses, isLoading: query.isLoading, findSaved, save, rename, remove }
}
