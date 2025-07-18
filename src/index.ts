import { readFileSync } from "fs";
import { join } from "path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { ValhallaClient } from "./clients/valhalla.js";
import { setupTools } from "./tools/index.js";
import { setupResources } from "./resources/index.js";
import { logger } from "./utils/logger.js";

function loadEnvSilently() {
  try {
    const envPath = join(process.cwd(), '.env');
    const envContent = readFileSync(envPath, 'utf8');
    
    for (const line of envContent.split('\n')) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=').replace(/^["']|["']$/g, ''); // Remove quotes
          if (!process.env[key]) { // Don't override existing env vars
            process.env[key] = value;
          }
        }
      }
    }
  } catch (error) {  }
}

loadEnvSilently();

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