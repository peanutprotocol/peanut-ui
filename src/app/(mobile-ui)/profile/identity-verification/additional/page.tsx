import { redirect } from 'next/navigation'

/** See ../page.tsx — the additional-verification screen moved alongside its parent. */
export default function AdditionalVerificationRedirect() {
    redirect('/profile/accounts-and-payments/additional')
}
