// React Query hooks for split rooms. Mutations return the full room snapshot,
// so we seed the cache from the response — balances update instantly with no
// second round-trip. A light refetch interval gives the "people are joining
// live" feel without websockets.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
	getRoom,
	getCurrencies,
	createRoom,
	addMember,
	addExpense,
	deleteExpense,
	recordSettlement,
} from '@/services/split'
import type { RoomState, NewExpenseInput, NewSettlementInput } from '@/services/split.types'

const roomKey = (slug: string) => ['split-room', slug] as const

export function useCurrenciesQuery() {
	return useQuery({ queryKey: ['split-currencies'], queryFn: getCurrencies, staleTime: Infinity, gcTime: Infinity })
}

export function useRoomQuery(slug: string) {
	return useQuery({
		queryKey: roomKey(slug),
		queryFn: () => getRoom(slug),
		refetchOnWindowFocus: true,
		refetchInterval: 8000,
		refetchIntervalInBackground: false,
		staleTime: 2000,
		retry: 1,
	})
}

function seedCache(qc: ReturnType<typeof useQueryClient>, slug: string) {
	return (state: RoomState) => qc.setQueryData(roomKey(slug), state)
}

export function useCreateRoom() {
	const qc = useQueryClient()
	return useMutation({
		mutationFn: (input: { title?: string; baseCurrency: string }) => createRoom(input),
		onSuccess: (state) => qc.setQueryData(roomKey(state.slug), state),
	})
}

export function useAddMember(slug: string) {
	const qc = useQueryClient()
	return useMutation({ mutationFn: (displayName: string) => addMember(slug, displayName), onSuccess: seedCache(qc, slug) })
}

export function useAddExpense(slug: string) {
	const qc = useQueryClient()
	return useMutation({ mutationFn: (input: NewExpenseInput) => addExpense(slug, input), onSuccess: seedCache(qc, slug) })
}

export function useDeleteExpense(slug: string) {
	const qc = useQueryClient()
	return useMutation({ mutationFn: (expenseId: string) => deleteExpense(slug, expenseId), onSuccess: seedCache(qc, slug) })
}

export function useRecordSettlement(slug: string) {
	const qc = useQueryClient()
	return useMutation({ mutationFn: (input: NewSettlementInput) => recordSettlement(slug, input), onSuccess: seedCache(qc, slug) })
}
