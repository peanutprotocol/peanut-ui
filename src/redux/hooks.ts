'use client'
import { type TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux'
import { type AppDispatch, type RootState } from './types'

export const useAppDispatch = () => useDispatch<AppDispatch>()
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector

// selector hooks for utilization
export const useSetupStore = () => useAppSelector((state) => state.setup)
export const useWalletStore = () => useAppSelector((state) => state.wallet)
export const useZerodevStore = () => useAppSelector((state) => state.zeroDev)
export const useUserStore = () => useAppSelector((state) => state.user)
