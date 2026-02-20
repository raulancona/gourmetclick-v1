import { useRef, useState, useEffect } from 'react'
import { CategoryPill } from './category-pill'

export function CategorySelector({ categories, selectedCategory, onSelectCategory }) {
    // Drag to scroll implementation
    const scrollContainerRef = useRef(null)
    const [isDragging, setIsDragging] = useState(false)
    const [startX, setStartX] = useState(0)
    const [scrollLeft, setScrollLeft] = useState(0)

    const handleMouseDown = (e) => {
        setIsDragging(true)
        setStartX(e.pageX - scrollContainerRef.current.offsetLeft)
        setScrollLeft(scrollContainerRef.current.scrollLeft)
    }

    // Attach listeners to document to handle drag outside container
    useEffect(() => {
        const handleMouseMove = (e) => {
            if (!isDragging) return
            e.preventDefault()
            const x = e.pageX - scrollContainerRef.current.offsetLeft
            const walk = (x - startX) * 2 // Scroll-fast
            scrollContainerRef.current.scrollLeft = scrollLeft - walk
        }

        const handleMouseUp = () => {
            setIsDragging(false)
        }

        if (isDragging) {
            document.addEventListener('mousemove', handleMouseMove)
            document.addEventListener('mouseup', handleMouseUp)
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseMove)
            document.removeEventListener('mouseup', handleMouseUp)
        }
    }, [isDragging, startX, scrollLeft])

    return (
        <div className="px-6 mb-4 shrink-0">
            <div
                ref={scrollContainerRef}
                className="flex gap-2 overflow-x-auto pb-2 no-scrollbar cursor-grab active:cursor-grabbing select-none"
                onMouseDown={handleMouseDown}
            >
                <CategoryPill
                    label="Todos"
                    active={selectedCategory === 'all'}
                    onClick={() => onSelectCategory('all')}
                />
                {categories.map(cat => (
                    <CategoryPill
                        key={cat.id}
                        label={cat.name}
                        active={selectedCategory === cat.id}
                        onClick={() => !isDragging && onSelectCategory(cat.id)}
                    />
                ))}
            </div>
        </div>
    )
}
