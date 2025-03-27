import { IUserProfile } from '@/interfaces'
import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { AUTH_SLICE } from '../constants'
import { IAuthState } from '../types/user.types'

const initialState: IAuthState = {
    user: null,
}

const userSlice = createSlice({
    name: AUTH_SLICE,
    initialState,
    reducers: {
        setUser: (state, action: PayloadAction<IUserProfile>) => {
            state.user = action.payload
        },
    },
})

export const userActions = userSlice.actions
export default userSlice.reducer
