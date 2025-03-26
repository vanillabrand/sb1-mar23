// Mock Vite's import.meta.env
jest.mock('virtual:env', () => ({
  default: {
    env: {
      VITE_DEEPSEEK_API_KEY: 'sk-d218e91b203f45ebb4ede94cbed76478',
      MODE: 'test',
      DEV: false,
      PROD: false,
    }
  }
}));

// Add any other global test setup here
