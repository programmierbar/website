import type { Tag } from '~/composables/useDirectus'
import { defineStore } from 'pinia'

interface MainInfos {
    firstName: string
    lastName: string
}

interface Details {
    role: string
    company: string
    location: string
    aboutMe: string
}

export const useProfileCreationStore = defineStore('profileCreation', {
    state: (): {
        mainInfos: MainInfos
        selectedEmojis: string[]
        selectedInterests: Tag[]
        details: Details
    } => ({
        mainInfos: {} as MainInfos,
        selectedEmojis: [],
        selectedInterests: [],
        details: {} as Details,
    }),
    actions: {
        updateMainInfos(data: MainInfos) {
            this.mainInfos = data
        },
        updateSelectedEmojis(emojis: string[]) {
            this.selectedEmojis = emojis
        },
        updateSelectedInterests(interests: Tag[]) {
            this.selectedInterests = interests
        },
        updateDetails(data: any) {
            this.details = data
        },
    },
})
