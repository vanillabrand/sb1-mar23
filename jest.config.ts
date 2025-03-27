export default {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/src/test/setup.ts'],
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '^@/(.*)$': '<rootDir>/src/$1',
    'virtual:env': '<rootDir>/src/test/vite-env-transform.js'
  },
  transform: {
    '^.+\\.(ts|tsx)$': [
      'ts-jest',
      {
        tsconfig: 'tsconfig.test.json',
        useESM: true
      }
    ]
  },
  testEnvironmentOptions: {
    url: 'http://localhost'
  },
  setupFiles: ['<rootDir>/src/test/setup-env.ts'],
  transformIgnorePatterns: [
    'node_modules/(?!(module-that-needs-transform|technicalindicators|ccxt)/)'
  ],
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node']
};
