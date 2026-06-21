module.exports = {
  projects: [
    {
      displayName: 'api',
      testEnvironment: 'node',
      roots: ['<rootDir>/apps/api'],
      testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
      transform: {
        '^.+\\.ts$': ['ts-jest', {
          tsconfig: {
            esModuleInterop: true,
            allowSyntheticDefaultImports: true,
          },
        }],
      },
      moduleFileExtensions: ['js', 'json', 'ts'],
      collectCoverageFrom: [
        'apps/api/src/**/*.ts',
        '!apps/api/src/**/*.d.ts',
        '!apps/api/src/main.ts',
      ],
    },
    {
      displayName: 'web',
      testEnvironment: 'jsdom',
      roots: ['<rootDir>/apps/web'],
      testMatch: ['**/__tests__/**/*.tsx', '**/?(*.)+(spec|test).tsx'],
      transform: {
        '^.+\\.tsx?$': ['ts-jest', {
          tsconfig: {
            jsx: 'react-jsx',
            esModuleInterop: true,
            allowSyntheticDefaultImports: true,
          },
        }],
      },
      moduleFileExtensions: ['js', 'json', 'ts', 'tsx'],
      collectCoverageFrom: [
        'apps/web/src/**/*.{ts,tsx}',
        '!apps/web/src/**/*.d.ts',
        '!apps/web/src/main.tsx',
      ],
    },
  ],
  collectCoverageFrom: [
    'apps/*/src/**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/dist/**',
  ],
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  coveragePathIgnorePatterns: ['/node_modules/', '/dist/'],
};
