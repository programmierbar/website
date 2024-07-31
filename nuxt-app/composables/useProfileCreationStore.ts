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
        profilePicture: {
            file: File | null
            previewUrl: string | null
        }
    } => ({
        mainInfos: {} as MainInfos,
        selectedEmojis: [],
        selectedInterests: [],
        details: {} as Details,
        profilePicture: {
            file: null,
            previewUrl: null,
        },
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
        updateProfilePicture(file: File, previewUrl: string) {
            this.profilePicture.file = file
            this.profilePicture.previewUrl = previewUrl
        },
    },
})
