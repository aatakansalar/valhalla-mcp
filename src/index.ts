import { config } from "dotenv";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { ValhallaClient } from "./clients/valhalla.js";
import { setupTools } from "./tools/index.js";
import { setupResources } from "./resources/index.js";
import { logger } from "./utils/logger.js";

// Load environment variables
config();

// Environment variables
const VALHALLA_BASE_URL = process.env.VALHALLA_BASE_URL || "http://localhost:8002";

// Create MCP server instance
const server = new McpServer({
  name: "valhalla-mcp-server",
  version: "0.1.0"
});

// Initialize Valhalla client
const valhallaClient = new ValhallaClient(VALHALLA_BASE_URL);

async function main() {
  try {
    logger.info("Initializing Valhalla MCP Server...");
    
    // Setup tools (routing, isochrone, etc.)
    setupTools(server, valhallaClient);
    
    // Setup resources (tiles, health)
    setupResources(server, valhallaClient);
    
    // Connect to stdio transport
    const transport = new StdioServerTransport();
    await server.connect(transport);
    
    logger.info("Valhalla MCP Server started successfully on stdio");
  } catch (error) {
    logger.error("Failed to start server:", error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  logger.info("Received SIGINT, shutting down gracefully...");
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info("Received SIGTERM, shutting down gracefully...");
  process.exit(0);
});

main().catch((error) => {
  logger.error("Fatal error:", error);
  process.exit(1);
}); 