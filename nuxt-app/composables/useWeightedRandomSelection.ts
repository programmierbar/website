import type { DirectusTestimonialItem } from '~/types'

/**
 * Seeded random number generator
 * Returns a pseudo-random number between 0 and 1 based on the seed
 */
function seededRandom(seed: number): number {
    const x = Math.sin(seed) * 10000
    return x - Math.floor(x)
}

/**
 * Generates an hourly seed that changes every hour
 * This ensures the same testimonials are shown for all users within the same hour
 */
function getHourlySeed(): number {
    return Math.floor(Date.now() / (1000 * 60 * 60))
}

/**
 * Selects a weighted random subset of testimonials
 * Higher weight = more likely to be selected
 */
export function useWeightedRandomSelection() {
    const selectTestimonials = (
        testimonials: DirectusTestimonialItem[],
        maxCount: number = 5
    ): DirectusTestimonialItem[] => {
        if (!testimonials || testimonials.length <= maxCount) {
            return testimonials || []
        }

        const seed = getHourlySeed()

        // Create weighted pool where each testimonial appears based on its weight
        const weightedPool: DirectusTestimonialItem[] = []
        testimonials.forEach((testimonial) => {
            const weight = testimonial.weight || 5 // Default weight of 5
            for (let i = 0; i < weight; i++) {
                weightedPool.push(testimonial)
            }
        })

        const selected: DirectusTestimonialItem[] = []
        const usedIds = new Set<string>()

        // Select unique testimonials using seeded randomness
        for (let i = 0; i < maxCount; i++) {
            let attempts = 0
            let selectedTestimonial: DirectusTestimonialItem

            do {
                const randomIndex = Math.floor(seededRandom(seed + i + attempts) * weightedPool.length)
                selectedTestimonial = weightedPool[randomIndex]
                attempts++
            } while (usedIds.has(selectedTestimonial.id) && attempts < 100)

            if (!usedIds.has(selectedTestimonial.id)) {
                selected.push(selectedTestimonial)
                usedIds.add(selectedTestimonial.id)
            }
        }

        return selected
    }

    return {
        selectTestimonials,
    }
}
