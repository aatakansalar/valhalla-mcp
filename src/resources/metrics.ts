import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { logger } from "../utils/logger.js";
import { metrics } from "../utils/metrics.js";
import { routeCache, isochroneCache, healthCache } from "../utils/cache.js";
import { generateRequestId } from "../utils/errors.js";

export function setupMetricsResource(server: McpServer): void {
  server.registerResource(
    "metrics",
    "metrics://summary",
    {
      title: "MCP Server Metrics",
      description: "Provides comprehensive performance metrics, cache statistics, and system health information",
      mimeType: "application/json"
    },
    async (uri: any): Promise<any> => {
      const requestId = generateRequestId();
      
      try {
        logger.info("Fetching MCP server metrics", { requestId });
        
        const summary = metrics.getSummary();
        const healthStatus = metrics.getHealthStatus();
        const recentErrors = metrics.getRecentErrors(5);
        const slowestRequests = metrics.getSlowestRequests(5);
        
        const responseData = {
          timestamp: new Date().toISOString(),
          requestId,
          system_health: {
            status: healthStatus.status,
            checks: healthStatus.checks,
            details: healthStatus.details
          },
          performance_metrics: {
            requests: {
              ...summary.requests,
              error_rate_percentage: (summary.requests.errorRate * 100).toFixed(2)
            },
            response_times: {
              ...summary.performance,
              p95_response_time_ms: summary.performance.p95ResponseTime
            },
            endpoints: summary.endpoints
          },
          cache_metrics: {
            ...summary.cache,
            hit_rate_percentage: (summary.cache.hitRate * 100).toFixed(2),
            individual_caches: {
              route: {
                size: routeCache.size(),
                stats: routeCache.getStats()
              },
              isochrone: {
                size: isochroneCache.size(),
                stats: isochroneCache.getStats()
              },
              health: {
                size: healthCache.size(),
                stats: healthCache.getStats()
              }
            }
          },
          debugging_info: {
            recent_errors: recentErrors.map(error => ({
              timestamp: new Date(error.timestamp).toISOString(),
              endpoint: error.endpoint,
              duration: error.duration,
              errorCode: error.errorCode,
              requestId: error.requestId
            })),
            slowest_requests: slowestRequests.map(request => ({
              timestamp: new Date(request.timestamp).toISOString(),
              endpoint: request.endpoint,
              duration: request.duration,
              success: request.success,
              requestId: request.requestId
            }))
          },
          uptime: {
            since: summary.lastReset,
            duration_hours: ((Date.now() - new Date(summary.lastReset).getTime()) / (1000 * 60 * 60)).toFixed(2)
          }
        };

        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "application/json",
              text: JSON.stringify(responseData, null, 2)
            }
          ]
        };

      } catch (error: any) {
        logger.error("Failed to fetch metrics", { 
          requestId,
          error: error?.message || 'Unknown error'
        });
        
        const errorData = {
          timestamp: new Date().toISOString(),
          requestId,
          error: "Failed to fetch metrics",
          message: error?.message || 'Unknown error'
        };

        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "application/json",
              text: JSON.stringify(errorData, null, 2)
            }
          ]
        };
      }
    }
  );

  logger.info("Metrics resource registered");
} 