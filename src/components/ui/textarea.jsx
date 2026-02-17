import { cn } from '../../lib/utils'

export function Textarea({ className, ...props }) {
    return (
        <textarea
            className={cn(
                'flex min-h-[80px] w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm',
                'placeholder:text-gray-400',
                'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
                'disabled:cursor-not-allowed disabled:opacity-50',
                'resize-none',
                className
            )}
            {...props}
        />
    )
}
