import { redirect } from 'next/navigation'

export default function SupportPage() {
    redirect('/en/help?chat=open')
}
