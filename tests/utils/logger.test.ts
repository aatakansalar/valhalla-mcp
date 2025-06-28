import { logger } from '../../src/utils/logger';

describe('Logger', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should log info messages', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    logger.info('Test message');
    expect(consoleSpy).toHaveBeenCalledWith('[INFO] Test message');
    consoleSpy.mockRestore();
  });

  test('should log error messages', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    logger.error('Error message');
    expect(consoleSpy).toHaveBeenCalledWith('[ERROR] Error message');
    consoleSpy.mockRestore();
  });

  test('should log warn messages', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    logger.warn('Warning message');
    expect(consoleSpy).toHaveBeenCalledWith('[WARN] Warning message');
    consoleSpy.mockRestore();
  });

  test('should only log debug when LOG_LEVEL is debug', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    
    // Debug should not log with default LOG_LEVEL (info)
    logger.debug('Debug message');
    expect(consoleSpy).not.toHaveBeenCalled();
    
    // Debug should log with LOG_LEVEL=debug
    const originalLogLevel = process.env.LOG_LEVEL;
    process.env.LOG_LEVEL = 'debug';
    
    // Since logger is a singleton, we need to test with a different approach
    // The logger checks LOG_LEVEL at runtime, so this should work
    logger.debug('Debug message');
    expect(consoleSpy).toHaveBeenCalledWith('[DEBUG] Debug message');
    
    // Restore original LOG_LEVEL
    process.env.LOG_LEVEL = originalLogLevel;
    consoleSpy.mockRestore();
  });
}); 