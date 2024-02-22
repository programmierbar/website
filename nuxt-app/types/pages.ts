import type { FileItem } from './items'

export interface PodcastPage {
    meta_title: string
    meta_description: string
    cover_image: FileItem
    intro_heading: string
    intro_text_1: string
    intro_text_2: string
    deep_dive_heading: string
    cto_special_heading: string
    news_heading: string
    other_heading: string
}

export interface MeetupPage {
    meta_title: string
    meta_description: string
    cover_image: FileItem
    intro_heading: string
    intro_text_1: string
    intro_text_2: string
    corona_text: string
    meetup_heading: string
}

export interface HallOfFamePage {
    meta_title: string
    meta_description: string
    intro_heading: string
    intro_text: string
}
