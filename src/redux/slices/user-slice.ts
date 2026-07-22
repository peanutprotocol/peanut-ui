import { type IUserProfile } from '@/interfaces/interfaces'
import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import { AUTH_SLICE } from '../constants'
import { type IAuthState } from '../types/user.types'
import { isDemoMode } from '@/utils/demo'
import { DEMO_USER } from '@/constants/demo-data'

// Demo mode: seed the synthetic user so `user` is never null on first render —
// prevents the protected-route layout racing a /setup redirect before the async
// user query settles.
const initialState: IAuthState = {
    user: isDemoMode() ? DEMO_USER : null,
}

const userSlice = createSlice({
    name: AUTH_SLICE,
    initialState,
    reducers: {
        setUser: (state, action: PayloadAction<IUserProfile | null>) => {
            state.user = action.payload
        },
    },
})

export const userActions = userSlice.actions
export default userSlice.reducer
