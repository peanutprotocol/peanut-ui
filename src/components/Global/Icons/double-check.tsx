import { type FC, type SVGProps } from 'react'

// Tighter fused double-tick than Lucide's CheckCheck (which draws them disjoint).
export const DoubleCheckIcon: FC<SVGProps<SVGSVGElement>> = ({ fill, ...props }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        width={24}
        height={24}
        fill={fill ?? 'currentColor'}
        {...props}
    >
        <path d="M17.3 6.3a.996.996 0 0 0-1.41 0l-5.64 5.64 1.41 1.41L17.3 7.7c.38-.38.38-1.02 0-1.4m4.24-.01-9.88 9.88-3.48-3.47a.996.996 0 0 0-1.41 0c-.39.39-.39 1.02 0 1.41l4.18 4.18c.39.39 1.02.39 1.41 0L22.95 7.71c.39-.39.39-1.02 0-1.41h-.01c-.38-.4-1.01-.4-1.4-.01M1.12 14.12 5.3 18.3c.39.39 1.02.39 1.41 0l.7-.7-4.88-4.9a.996.996 0 0 0-1.41 0c-.39.39-.39 1.03 0 1.42" />
    </svg>
)
