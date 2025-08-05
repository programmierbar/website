import { describe, expect, test, jest, beforeEach } from '@jest/globals';
import { getPayloadWithSlug } from './../util/getPayloadWithSlug.ts';

describe('getPayloadWithSlug', () => {
    beforeEach(() => {
        // Clear all mocks before each test
        jest.clearAllMocks();
    });

    test('should generate slug for speakers', async () => {
        // Arrange
        const futureItem = {
            academic_title: 'Dr.',
            first_name: 'John',
            last_name: 'Doe',
        };
        const payload = { name: 'John Doe' };
        const metadata = { collection: 'speakers', keys: ['123'] };

        // Act
        const result = await getPayloadWithSlug(futureItem, { payload, metadata });

        // Assert
        expect(result).toEqual({
            ...payload,
            slug: 'dr-john-doe',
        });
    });

    test('should not generate slug for incomplete podcasts', async () => {
        // Arrange
        const futureItem = {
            type: 'news',
            number: null,
            title: 'Topic A // Topic B // Topic C',
        };
        const payload = { title: 'Topic A // Topic B // Topic C' };
        const metadata = { collection: 'podcasts', keys: ['456'] };

        // Act
        const result = await getPayloadWithSlug(futureItem, { payload, metadata });

        // Assert
        expect(result).toEqual(payload);
    });

    test('should generate slug for podcasts - deep dive', async () => {
        // Arrange
        const futureItem = {
            type: 'deep_dive',
            number: '42',
            title: 'Understanding Jest',
        };
        const payload = { title: 'Understanding Jest' };
        const metadata = { collection: 'podcasts', keys: ['456'] };

        // Act
        const result = await getPayloadWithSlug(futureItem, { payload, metadata });

        // Assert
        expect(result).toEqual({
            ...payload,
            slug: 'deep-dive-42-understanding-jest',
        });
    });

    test('should generate slug for podcasts - news', async () => {
        // Arrange
        const futureItem = {
            type: 'news',
            number: '01/23',
            title: 'Topic A // Topic B // Topic C',
        };
        const payload = { title: 'Topic A // Topic B // Topic C' };
        const metadata = { collection: 'podcasts', keys: ['456'] };

        // Act
        const result = await getPayloadWithSlug(futureItem, { payload, metadata });

        // Assert
        expect(result).toEqual({
            ...payload,
            slug: 'news-01-23-topic-a-topic-b-topic-c',
        });
    });

    test('should generate slug for podcasts - cto special', async () => {
        // Arrange
        const futureItem = {
            type: 'cto_special',
            number: '123',
            title: 'John Doe',
        };
        const payload = { title: 'John Doe' };
        const metadata = { collection: 'podcasts', keys: ['456'] };

        // Act
        const result = await getPayloadWithSlug(futureItem, { payload, metadata });

        // Assert
        expect(result).toEqual({
            ...payload,
            slug: 'cto-special-123-john-doe',
        });
    });

    test('should generate slug for podcasts - other with number', async () => {
        // Arrange
        const futureItem = {
            type: 'other',
            number: '123',
            title: 'Something happened!',
        };
        const payload = { title: 'Something happened!' };
        const metadata = { collection: 'podcasts', keys: ['456'] };

        // Act
        const result = await getPayloadWithSlug(futureItem, { payload, metadata });

        // Assert
        expect(result).toEqual({
            ...payload,
            slug: 'spezialfolge-123-something-happened',
        });
    });

    test('should generate slug for podcasts - other without number', async () => {
        // Arrange
        const futureItem = {
            type: 'other',
            number: null,
            title: 'Something happened!',
        };
        const payload = { title: 'Something happened!' };
        const metadata = { collection: 'podcasts', keys: ['456'] };

        // Act
        const result = await getPayloadWithSlug(futureItem, { payload, metadata });

        // Assert
        expect(result).toEqual({
            ...payload,
            slug: 'spezialfolge-something-happened',
        });
    });

    test('should generate slug for meetups', async () => {
        // Arrange
        const futureItem = {
            title: 'JavaScript Meetup 2025',
        };
        const payload = { title: 'JavaScript Meetup 2025' };
        const metadata = { collection: 'meetups', keys: ['789'] };

        // Act
        const result = await getPayloadWithSlug(futureItem, { payload, metadata });

        // Assert
        expect(result).toEqual({
            ...payload,
            slug: 'javascript-meetup-2025',
        });
    });

    test('should generate slug for conferences', async () => {
        // Arrange
        const futureItem = {
            title: 'TypeScript Conference 2025',
        };
        const payload = { title: 'TypeScript Conference 2025' };
        const metadata = { collection: 'conferences', keys: ['101'] };

        // Act
        const result = await getPayloadWithSlug(futureItem, { payload, metadata });

        // Assert
        expect(result).toEqual({
            ...payload,
            slug: 'typescript-conference-2025',
        });
    });

    test('should generate slug for profiles with first_name and last_name', async () => {
        // Arrange
        const futureItem = {
            first_name: 'Jane',
            last_name: 'Smith',
            update_slug: true,
        };
        const payload = { name: 'Jane Smith' };
        const metadata = { collection: 'profiles', keys: ['202'] };

        // Act
        const result = await getPayloadWithSlug(futureItem, { payload, metadata });

        // Assert
        expect(result.slug).toMatch(/^jane-smith-[a-z0-9]{4}$/);
    });

    test('should not update slug for profiles when update_slug is false', async () => {
        // Arrange
        const futureItem = {
            first_name: 'Jane',
            last_name: 'Smith',
            update_slug: false,
        };
        const payload = { name: 'Jane Smith' };
        const metadata = { collection: 'profiles', keys: ['202'] };

        // Act
        const result = await getPayloadWithSlug(futureItem, { payload, metadata });

        // Assert
        expect(result).toEqual(payload);
    });

    test('should return original payload for unsupported collection', async () => {
        // Arrange
        const futureItem = {
            title: 'Some Title',
        };
        const payload = { title: 'Some Title' };
        const metadata = { collection: 'unsupported', keys: ['303'] };

        // Act
        const result = await getPayloadWithSlug(futureItem, { payload, metadata });

        // Assert
        expect(result).toEqual(payload);
    });

    test('should return original payload when required fields are missing', async () => {
        // Arrange
        const futureItem = {
            // Missing first_name and last_name
        };
        const payload = { name: 'Incomplete' };
        const metadata = { collection: 'speakers', keys: ['404'] };

        // Act
        const result = await getPayloadWithSlug(futureItem, { payload, metadata });

        // Assert
        expect(result).toEqual(payload);
    });

    test('should handle newly created items without keys', async () => {
        // Arrange
        const futureItem = {
            title: 'New Meetup',
        };
        const payload = { title: 'New Meetup' };
        const metadata = { collection: 'meetups' }; // No keys for new items

        // Act
        const result = await getPayloadWithSlug(futureItem, { payload, metadata });

        // Assert
        expect(result).toEqual({
            ...payload,
            slug: 'new-meetup',
        });
    });

    afterAll(() => {
    });
});
