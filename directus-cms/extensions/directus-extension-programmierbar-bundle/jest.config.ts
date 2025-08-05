import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest/presets/js-with-ts-esm',
  testEnvironment: 'node',
  moduleFileExtensions: ['ts', 'js', 'json'],
  extensionsToTreatAsEsm: ['.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      useESM: true,
    }],
  },
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleNameMapper: {
    // Handle module aliases (if needed)
    '^../../../../../shared-code/(.*)$': '<rootDir>/../../../shared-code/$1',
  },
  // Setup files if needed
  // setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
};

export default config;
