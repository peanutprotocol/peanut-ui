'use client'

interface FloatingReferralButtonProps {
    onClick: () => void
}

const FloatingReferralButton: React.FC<FloatingReferralButtonProps> = ({ onClick }) => {
    return (
        <button
            onClick={onClick}
            className="absolute right-1 top-20 z-50 !w-12 animate-pulse cursor-pointer text-4xl transition-all duration-300 hover:scale-110 hover:animate-none md:hidden"
            aria-label="Open referral campaign"
        >
            💝
        </button>
    )
}

export default FloatingReferralButton
