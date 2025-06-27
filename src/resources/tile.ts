import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ValhallaClient } from "../clients/valhalla.js";
import { logger } from "../utils/logger.js";

export function setupTileResource(server: McpServer, valhallaClient: ValhallaClient): void {
  server.registerResource(
    "tile",
    new ResourceTemplate("tile://{z}/{x}/{y}", { list: undefined }),
    {
      title: "Valhalla Vector Tile",
      description: "Provides Valhalla vector tiles in Mapbox protobuf format for client-side rendering",
      mimeType: "application/x-protobuf"
    },
    async (uri: any, params: any) => {
      try {
        const { z, x, y } = params;
        
        // Validate tile coordinates
        const zoom = parseInt(z as string);
        const tileX = parseInt(x as string);
        const tileY = parseInt(y as string);
        
        if (isNaN(zoom) || isNaN(tileX) || isNaN(tileY)) {
          throw new Error("Invalid tile coordinates");
        }
        
        if (zoom < 0 || zoom > 18) {
          throw new Error("Zoom level must be between 0 and 18");
        }
        
        const maxTileIndex = Math.pow(2, zoom) - 1;
        if (tileX < 0 || tileX > maxTileIndex || tileY < 0 || tileY > maxTileIndex) {
          throw new Error(`Tile coordinates out of range for zoom level ${zoom}`);
        }
        
        logger.info(`Fetching tile ${zoom}/${tileX}/${tileY}`);
        
        // Fetch tile data from Valhalla
        const tileData = await valhallaClient.tile(zoom, tileX, tileY);
        
        // Convert Buffer to base64 for transport
        const base64Data = tileData.toString('base64');
        
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "application/x-protobuf",
              blob: base64Data
            }
          ]
        };

      } catch (error) {
        logger.error(`Failed to fetch tile ${params.z}/${params.x}/${params.y}:`, error);
        
        // Return error as JSON
        const errorData = {
          error: "Failed to fetch tile",
          message: error instanceof Error ? error.message : "Unknown error",
          type: "tile_error",
          tile: {
            z: params.z,
            x: params.x,
            y: params.y
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

  logger.info("Tile resource registered");
} 