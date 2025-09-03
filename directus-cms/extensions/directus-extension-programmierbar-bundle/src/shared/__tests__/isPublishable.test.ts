import { describe, expect, test, jest, beforeEach } from '@jest/globals';
import { isPublishable } from './../isPublishable.ts';
// This configuration is acquired from the log output of interface extension running in directus
import PodcastFields from './podcasts_fields.json'

describe('isPublishable', () => {
    beforeEach(() => {
        // Clear all mocks before each test
        jest.clearAllMocks();
    });

    test('Episode with full details should be publishable', async () => {
        const item = {
            title: 'Podcast Title',
            type: 'news',
            number: '123',
            slug: 'slug',
            description: 'Description',
            cover_image: 'id123',
            audio_file: 'id123',
        }

        const publishableResult = isPublishable(item, PodcastFields)
        expect(publishableResult).toEqual(true);
    });

    test.each([
        [
            {
                title: null,
                type: 'news',
                number: '123',
                slug: 'slug',
                description: 'Description',
                cover_image: 'id123',
                audio_file: 'id123',
            },
            false,
            'missing title',
        ],
        [
            {
                title: 'Podcast Title',
                type: null,
                number: '123',
                slug: 'slug',
                description: 'Description',
                cover_image: 'id123',
                audio_file: 'id123',
            },
            false,
            'missing type',
        ],
        [
            {
                title: 'Podcast Title',
                type: 'news',
                number: '123',
                slug: null,
                description: 'Description',
                cover_image: 'id123',
                audio_file: 'id123',
            },
            false,
            'missing slug',
        ],
        [
            {
                title: 'Podcast Title',
                type: 'news',
                number: '123',
                slug: 'slug',
                description: null,
                cover_image: 'id123',
                audio_file: 'id123',
            },
            false,
            'missing description',
        ],
        [
            {
                title: 'Podcast Title',
                type: 'news',
                number: '123',
                slug: 'slug',
                description: 'Description',
                cover_image: null,
                audio_file: 'id123',
            },
            false,
            'missing cover_image',
        ],
        [
            {
                title: 'Podcast Title',
                type: 'news',
                number: '123',
                slug: 'slug',
                description: 'Description',
                cover_image: 'id123',
                audio_file: null,
            },
            false,
            'missing audio_file',
        ],
    ])('Episode %s should be publishable: %s', async (item, expected, reason
    ) => {
        const result = isPublishable(item, PodcastFields);
        expect(result).toBe(expected);
    });


    test.each([
        [
            {
                title: 'Podcast Title',
                type: 'news',
                number: null,
                slug: 'slug',
                description: 'Description',
                cover_image: 'id123',
                audio_file: 'id123',
            },
            false,
            'News episodes require a number',
        ],
        [
            {
                title: 'Podcast Title',
                type: 'deep_dive',
                number: null,
                slug: 'slug',
                description: 'Description',
                cover_image: 'id123',
                audio_file: 'id123',
            },
            false,
            'Deep dive episodes require a number',
        ],
        [
            {
                title: 'Podcast Title',
                type: 'cto_special',
                number: null,
                slug: 'slug',
                description: 'Description',
                cover_image: 'id123',
                audio_file: 'id123',
            },
            false,
            'CTO special episodes require a number',
        ],
        [
            {
                title: 'Podcast Title',
                type: 'other',
                number: null,
                slug: 'slug',
                description: 'Description',
                cover_image: 'id123',
                audio_file: 'id123',
            },
            true,
            'Other episodes do not require a number',
        ],

    ])('Number is optional for some episodes %s to be publishable: %s', async (item, expected, reason
    ) => {
        const result = isPublishable(item, PodcastFields);
        expect(result).toBe(expected);
    });

    afterAll(() => {
    });
});
