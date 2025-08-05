# Testing the `getPayloadWithSlug` Function

This directory contains tests for the `getPayloadWithSlug` function in the set-slug hook.

## Testing Approach

The `getPayloadWithSlug` function is tested using Jest, a popular JavaScript testing framework. The tests verify that the function correctly generates URL slugs for different types of content (speakers, podcasts, meetups, conferences, profiles) and handles various edge cases.

### Test Structure

- **Test Utility**: The `utils/getPayloadWithSlug.ts` file contains a copy of the function with mocked dependencies for testing purposes.
- **Test File**: The `getPayloadWithSlug.test.ts` file contains the actual tests.

### Test Cases

The tests cover the following scenarios:

1. **Speakers**: Generating slugs for speakers with academic titles, first names, and last names.
2. **Podcasts**: Generating slugs for podcasts with type, number, and title.
3. **Meetups**: Generating slugs for meetups with titles.
4. **Conferences**: Generating slugs for conferences with titles.
5. **Profiles**: Generating slugs for profiles with first names and last names.
6. **Edge Cases**:
   - Not updating slugs for profiles when `update_slug` is set to `false`.
   - Handling unsupported collections.
   - Handling missing required fields.
   - Handling newly created items without keys.

## Running the Tests

To run the tests, use the following command from the project root:

```bash
npm test
```

## Adding More Tests

To add more tests:

1. Add new test cases to the `getPayloadWithSlug.test.ts` file.
2. Follow the existing pattern of Arrange-Act-Assert:
   - **Arrange**: Set up the test data (futureItem, payload, metadata).
   - **Act**: Call the function being tested.
   - **Assert**: Verify the results using Jest's expect functions.
