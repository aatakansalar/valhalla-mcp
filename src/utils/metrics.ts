export interface MetricsSummary {
  requests: {
    total: number;
    successful: number;
    failed: number;
    errorRate: number;
  };
  performance: {
    averageResponseTime: number;
    minResponseTime: number;
    maxResponseTime: number;
    p95ResponseTime: number;
  };
  cache: {
    hits: number;
    misses: number;
    hitRate: number;
  };
  endpoints: Record<string, {
    count: number;
    averageTime: number;
    errorCount: number;
  }>;
  lastReset: string;
}

export interface RequestMetric {
  endpoint: string;
  method: string;
  duration: number;
  success: boolean;
  timestamp: number;
  requestId?: string;
  errorCode?: number;
}

export class MetricsCollector {
  private requests: RequestMetric[] = [];
  private cacheHits = 0;
  private cacheMisses = 0;
  private startTime = Date.now();
  private maxHistorySize = 1000; // Keep last 1000 requests for metrics

  // Record a request
  recordRequest(metric: RequestMetric): void {
    this.requests.push(metric);
    
    // Keep only last N requests to prevent memory issues
    if (this.requests.length > this.maxHistorySize) {
      this.requests = this.requests.slice(-this.maxHistorySize);
    }
  }

  // Record cache events
  recordCacheHit(): void {
    this.cacheHits++;
  }

  recordCacheMiss(): void {
    this.cacheMisses++;
  }

  // Get comprehensive metrics summary
  getSummary(): MetricsSummary {
    const totalRequests = this.requests.length;
    const successfulRequests = this.requests.filter(r => r.success).length;
    const failedRequests = totalRequests - successfulRequests;
    
    const responseTimes = this.requests.map(r => r.duration);
    const averageResponseTime = responseTimes.length > 0 
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length 
      : 0;
    
    const sortedTimes = responseTimes.sort((a, b) => a - b);
    const p95Index = Math.floor(sortedTimes.length * 0.95);
    
    const endpointStats: Record<string, { count: number; averageTime: number; errorCount: number }> = {};
    
    // Calculate per-endpoint statistics
    for (const request of this.requests) {
      const key = `${request.method} ${request.endpoint}`;
      if (!endpointStats[key]) {
        endpointStats[key] = { count: 0, averageTime: 0, errorCount: 0 };
      }
      
      endpointStats[key].count++;
      endpointStats[key].averageTime = 
        (endpointStats[key].averageTime * (endpointStats[key].count - 1) + request.duration) / 
        endpointStats[key].count;
      
      if (!request.success) {
        endpointStats[key].errorCount++;
      }
    }

    const totalCacheRequests = this.cacheHits + this.cacheMisses;
    
    return {
      requests: {
        total: totalRequests,
        successful: successfulRequests,
        failed: failedRequests,
        errorRate: totalRequests > 0 ? failedRequests / totalRequests : 0
      },
      performance: {
        averageResponseTime: Math.round(averageResponseTime),
        minResponseTime: responseTimes.length > 0 ? Math.min(...responseTimes) : 0,
        maxResponseTime: responseTimes.length > 0 ? Math.max(...responseTimes) : 0,
        p95ResponseTime: sortedTimes.length > 0 ? sortedTimes[p95Index] || 0 : 0
      },
      cache: {
        hits: this.cacheHits,
        misses: this.cacheMisses,
        hitRate: totalCacheRequests > 0 ? this.cacheHits / totalCacheRequests : 0
      },
      endpoints: endpointStats,
      lastReset: new Date(this.startTime).toISOString()
    };
  }

  // Reset all metrics
  reset(): void {
    this.requests = [];
    this.cacheHits = 0;
    this.cacheMisses = 0;
    this.startTime = Date.now();
  }

  // Get recent errors for debugging
  getRecentErrors(limit = 10): RequestMetric[] {
    return this.requests
      .filter(r => !r.success)
      .slice(-limit)
      .reverse();
  }

  // Get slowest requests for performance analysis
  getSlowestRequests(limit = 10): RequestMetric[] {
    return this.requests
      .slice()
      .sort((a, b) => b.duration - a.duration)
      .slice(0, limit);
  }

  // Health check based on recent metrics
  getHealthStatus(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    checks: Record<string, boolean>;
    details: string[];
  } {
    const recentRequests = this.requests.slice(-50); // Last 50 requests
    const recentErrorRate = recentRequests.length > 0 
      ? recentRequests.filter(r => !r.success).length / recentRequests.length 
      : 0;
    
    const recentAvgTime = recentRequests.length > 0
      ? recentRequests.reduce((sum, r) => sum + r.duration, 0) / recentRequests.length
      : 0;

    const checks = {
      errorRate: recentErrorRate < 0.1, // Less than 10% error rate
      responseTime: recentAvgTime < 5000, // Less than 5 seconds average
      hasRecentActivity: recentRequests.length > 0
    };

    const failedChecks = Object.entries(checks).filter(([_, passed]) => !passed);
    const details: string[] = [];

    if (recentErrorRate >= 0.1) {
      details.push(`High error rate: ${(recentErrorRate * 100).toFixed(1)}%`);
    }
    if (recentAvgTime >= 5000) {
      details.push(`Slow response time: ${recentAvgTime.toFixed(0)}ms`);
    }
    if (recentRequests.length === 0) {
      details.push('No recent activity');
    }

    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (failedChecks.length === 0) {
      status = 'healthy';
    } else if (failedChecks.length === 1) {
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }

    return { status, checks, details };
  }
}

// Performance measurement utility
export function measureTime<T>(fn: () => Promise<T>): Promise<{ result: T; duration: number }> {
  const start = Date.now();
  return fn().then(result => ({
    result,
    duration: Date.now() - start
  }));
}

// Global metrics instance
export const metrics = new MetricsCollector(); 