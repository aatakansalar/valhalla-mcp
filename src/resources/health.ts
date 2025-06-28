import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ValhallaClient } from "../clients/valhalla.js";
import { logger } from "../utils/logger.js";
import { healthCache } from "../utils/cache.js";
import { handleError, generateRequestId } from "../utils/errors.js";
import { metrics, measureTime } from "../utils/metrics.js";

export function setupHealthResource(server: McpServer, valhallaClient: ValhallaClient): void {
  server.registerResource(
    "health",
    "health://status",
    {
      title: "Valhalla Health Status",
      description: "Provides current health status and version information of the Valhalla routing engine",
      mimeType: "application/json"
    },
    async (uri: any): Promise<any> => {
      const requestId = generateRequestId();
      const startTime = Date.now();

      try {
        logger.info("Fetching Valhalla health status", { requestId });
        
        // Check cache first
        const cacheKey = "health:status";
        const cachedResult = healthCache.get(cacheKey);
        if (cachedResult) {
          metrics.recordCacheHit();
          logger.info("Health status served from cache", { requestId });
          return cachedResult;
        }
        
        metrics.recordCacheMiss();
        
        // Get Valhalla health data with performance measurement
        const { result: healthData, duration: apiDuration } = await measureTime(
          () => valhallaClient.health()
        );
        
        // Get MCP server metrics
        const serverMetrics = metrics.getSummary();
        const serverHealth = metrics.getHealthStatus();
        
        const responseData = {
          status: serverHealth.status,
          timestamp: new Date().toISOString(),
          requestId,
          valhalla: {
            version: healthData.version,
            tileset_last_modified: new Date(healthData.tileset_last_modified * 1000).toISOString(),
            available_actions: healthData.available_actions,
            api_duration_ms: apiDuration,
            capabilities: {
              has_transit_tiles: healthData.has_transit_tiles,
              has_admins: healthData.has_admins,
              has_timezones: healthData.has_timezones,
              has_live_traffic: healthData.has_live_traffic
            }
          },
          mcp_server: {
            name: "valhalla-mcp-server",
            version: "0.1.0",
            supported_tools: ["route", "isochrone"],
            supported_resources: ["health", "tile"],
            health_checks: serverHealth.checks,
            health_details: serverHealth.details,
            metrics: {
              requests: serverMetrics.requests,
              performance: serverMetrics.performance,
              cache: serverMetrics.cache,
              uptime_since: serverMetrics.lastReset
            }
          }
        };

        const result = {
          contents: [
            {
              uri: uri.href,
              mimeType: "application/json",
              text: JSON.stringify(responseData, null, 2)
            }
          ]
        };

        // Cache the result
        healthCache.set(cacheKey, result);

        // Record successful metrics
        metrics.recordRequest({
          endpoint: '/health',
          method: 'GET',
          duration: Date.now() - startTime,
          success: true,
          timestamp: Date.now(),
          requestId
        });

        logger.info("Health status fetched successfully", { 
          requestId, 
          apiDuration,
          serverStatus: serverHealth.status
        });

        return result;

      } catch (error: any) {
        // Record failed request metrics
        metrics.recordRequest({
          endpoint: '/health',
          method: 'GET',
          duration: Date.now() - startTime,
          success: false,
          timestamp: Date.now(),
          requestId,
          errorCode: error?.code || 500
        });

        logger.error("Failed to fetch health status", { 
          requestId,
          error: error?.message || 'Unknown error',
          stack: error?.stack 
        });
        
        const errorResponse = handleError(error, requestId);
        
        const errorData = {
          status: "unhealthy",
          timestamp: new Date().toISOString(),
          requestId,
          error: errorResponse,
          mcp_server: {
            name: "valhalla-mcp-server",
            version: "0.1.0",
            health_checks: {
              errorRate: false,
              responseTime: false,
              hasRecentActivity: false
            }
          }
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

  logger.info("Health resource registered");
} 