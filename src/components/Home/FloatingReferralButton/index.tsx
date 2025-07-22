'use client'

interface FloatingReferralButtonProps {
    onClick: () => void
}

const FloatingReferralButton: React.FC<FloatingReferralButtonProps> = ({ onClick }) => {
    return (
        <button
            onClick={onClick}
            className="absolute left-[43%] top-[15%] z-50 animate-pulse cursor-pointer text-4xl transition-all duration-300 hover:scale-110 hover:animate-none"
            aria-label="Open referral campaign"
        >
            💝
        </button>
    )
}

export default FloatingReferralButton
