import type { paths } from './api.generated'

export type SignupPreferences = NonNullable<
    paths['/add-account']['post']['requestBody']['content']['application/json']['signupPreferences']
>
