# Automated Testing Setup for directus-extension-programmierbar-bundle

This document provides an overview of the automated testing setup for the `directus-extension-programmierbar-bundle` project.

## Testing Framework

The project uses Jest as the testing framework, with the following configuration:

- **TypeScript Support**: Using ts-jest for TypeScript support
- **Test Files**: Located in `__tests__` directories with `.test.ts` extension
- **Configuration**: Jest configuration in `jest.config.ts`

## Test Structure

The tests are organized as follows:

- Each extension has its own `__tests__` directory
- Test files are named after the function or component they test
- Test utilities are stored in a `utils` directory within the `__tests__` directory

## Running Tests

To run the tests, use the following command:

```bash
npm test
```

## Current Test Coverage

The following components have automated tests:

- `getPayloadWithSlug` function in the `set-slug` hook

## Adding More Tests

To add tests for other components:

1. Create a `__tests__` directory in the component's directory
2. Create a test file with the `.test.ts` extension
3. Write tests using Jest's testing functions
4. Run the tests to verify they work

## Test Documentation

Each `__tests__` directory contains a README.md file that explains:

- The testing approach for that component
- The test cases covered
- How to run the tests
- How to add more tests
- The mocking strategy used

## Dependencies

The testing setup uses the following dependencies:

- jest: The testing framework
- ts-jest: TypeScript support for Jest
- @types/jest: TypeScript type definitions for Jest
- @jest/globals: Global functions and types for Jest
- ts-node: For running TypeScript files directly

These dependencies are listed in the `package.json` file.
