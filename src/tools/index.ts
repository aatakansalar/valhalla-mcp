import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ValhallaClient } from "../clients/valhalla.js";
import { setupRouteTool } from "./route.js";
import { setupIsochroneTool } from "./isochrone.js";
import { logger } from "../utils/logger.js";

export function setupTools(server: McpServer, valhallaClient: ValhallaClient): void {
  logger.info("Setting up MCP tools...");
  
  // Route tool - primary path calculation
  setupRouteTool(server, valhallaClient);
  
  // Isochrone tool - travel time polygons
  setupIsochroneTool(server, valhallaClient);
  
  logger.info("All tools registered successfully");
} 