import { CrispButton } from '@/components/CrispChat'
import MoreInfo from '@/components/Global/MoreInfo'

export const FAQComponent = ({ className }: { className?: string }) => {
    return (
        <div className={`flex w-full items-center justify-start gap-1 text-left text-h8 ${className}`}>
            FAQ{' '}
            <MoreInfo text="">
                <p>
                    Cashing out requires KYC.
                    <br></br>Min cashout: $10, max $100k.
                </p>
                <br></br>
                <p>Fees:</p>
                <ul className="list-disc pl-5">
                    <li>Peanut sponsors gas</li>
                    <li>We have to charge a $1 fee for EU cashouts, and $0.5 for US transfers</li>
                </ul>
                <br></br>
                <p>Usually takes 20mins, but can take up to 3 business days.</p>
                <CrispButton className="mt-2 text-blue-600 underline">Need help? Chat with support</CrispButton>
            </MoreInfo>
        </div>
    )
}
