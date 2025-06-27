import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ValhallaClient } from "../clients/valhalla.js";
import { setupHealthResource } from "./health.js";
import { setupTileResource } from "./tile.js";
import { logger } from "../utils/logger.js";

export function setupResources(server: McpServer, valhallaClient: ValhallaClient): void {
  logger.info("Setting up MCP resources...");
  
  // Health resource - server status and version info
  setupHealthResource(server, valhallaClient);
  
  // Tile resource - vector tiles for rendering
  setupTileResource(server, valhallaClient);
  
  logger.info("All resources registered successfully");
} 