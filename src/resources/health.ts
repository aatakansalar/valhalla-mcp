import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ValhallaClient } from "../clients/valhalla.js";
import { logger } from "../utils/logger.js";

export function setupHealthResource(server: McpServer, valhallaClient: ValhallaClient): void {
  server.registerResource(
    "health",
    "health://status",
    {
      title: "Valhalla Health Status",
      description: "Provides current health status and version information of the Valhalla routing engine",
      mimeType: "application/json"
    },
    async (uri: any) => {
      try {
        logger.info("Fetching Valhalla health status");
        
        const healthData = await valhallaClient.health();
        
        const responseData = {
          status: "healthy",
          timestamp: new Date().toISOString(),
          valhalla: {
            version: healthData.version,
            tileset_last_modified: new Date(healthData.tileset_last_modified * 1000).toISOString(),
            available_actions: healthData.available_actions,
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
            supported_resources: ["health", "tile"]
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

      } catch (error) {
        logger.error("Failed to fetch health status:", error);
        
        const errorData = {
          status: "unhealthy",
          timestamp: new Date().toISOString(),
          error: {
            message: error instanceof Error ? error.message : "Unknown error",
            type: "health_check_failed"
          },
          mcp_server: {
            name: "valhalla-mcp-server",
            version: "0.1.0"
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