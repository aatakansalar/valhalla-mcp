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

  test('should only log debug when DEBUG env is set', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    
    // Without DEBUG env
    delete process.env.DEBUG;
    logger.debug('Debug message');
    expect(consoleSpy).not.toHaveBeenCalled();
    
    // With DEBUG env
    process.env.DEBUG = 'true';
    logger.debug('Debug message');
    expect(consoleSpy).toHaveBeenCalledWith('[DEBUG] Debug message');
    
    consoleSpy.mockRestore();
  });
}); 