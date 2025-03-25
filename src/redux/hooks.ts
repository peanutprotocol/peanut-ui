import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux'
import { AppDispatch, RootState } from './types'

export const useAppDispatch = () => useDispatch<AppDispatch>()
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector

// Selector hooks for utilization
export const useSetupStore = () => useAppSelector((state) => state.setup)
export const useWalletStore = () => useAppSelector((state) => state.wallet)
export const useZerodevStore = () => useAppSelector((state) => state.zeroDev)
export const usePaymentStore = () => useAppSelector((state) => state.payment)
export const useUserStore = () => useAppSelector((state) => state.user)
