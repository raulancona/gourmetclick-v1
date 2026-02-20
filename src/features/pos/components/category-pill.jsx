export function CategoryPill({ label, active, onClick }) {
    return (
        <button
            onClick={onClick}
            className={`
                px-5 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all border
                ${active
                    ? 'bg-primary text-primary-foreground border-primary shadow-md'
                    : 'bg-card text-muted-foreground border-border hover:border-primary/50 hover:bg-muted'}
            `}
        >
            {label}
        </button>
    )
}
