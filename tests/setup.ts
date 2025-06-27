// Test setup for Jest
global.console = {
  ...console,
  // Silent console during tests unless DEBUG is set
  log: process.env.DEBUG ? console.log : jest.fn(),
  debug: process.env.DEBUG ? console.debug : jest.fn(),
  info: process.env.DEBUG ? console.info : jest.fn(),
  warn: console.warn,
  error: console.error,
};

// Set test environment variables
process.env.VALHALLA_BASE_URL = process.env.VALHALLA_BASE_URL || 'http://localhost:8002';
process.env.NODE_ENV = 'test'; 