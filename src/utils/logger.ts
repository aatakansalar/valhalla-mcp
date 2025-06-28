export interface Logger {
  info(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  debug(message: string, ...args: any[]): void;
}

class ConsoleLogger implements Logger {
  private shouldLog(level: string): boolean {
    const levels = ['error', 'warn', 'info', 'debug'];
    const currentLogLevel = process.env.LOG_LEVEL || 'info';
    const currentLevelIndex = levels.indexOf(currentLogLevel);
    const messageLogLevelIndex = levels.indexOf(level);
    return messageLogLevelIndex <= currentLevelIndex;
  }

  info(message: string, ...args: any[]): void {
    if (this.shouldLog('info')) {
      // MCP servers use stdio for JSON-RPC, so log to stderr
      console.error(`[INFO] ${message}`, ...args);
    }
  }

  error(message: string, ...args: any[]): void {
    if (this.shouldLog('error')) {
      console.error(`[ERROR] ${message}`, ...args);
    }
  }

  warn(message: string, ...args: any[]): void {
    if (this.shouldLog('warn')) {
      console.error(`[WARN] ${message}`, ...args);
    }
  }

  debug(message: string, ...args: any[]): void {
    if (this.shouldLog('debug')) {
      console.error(`[DEBUG] ${message}`, ...args);
    }
  }
}

export const logger = new ConsoleLogger(); 