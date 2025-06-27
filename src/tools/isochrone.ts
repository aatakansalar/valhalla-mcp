import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ValhallaClient, IsochroneRequest } from "../clients/valhalla.js";
import { logger } from "../utils/logger.js";

// Input schema for isochrone tool - using Zod for validation
const IsochroneInputRawShape = {
  origin: z.object({
    lat: z.number().min(-90).max(90),
    lon: z.number().min(-180).max(180)
  }),
  minutes: z.number().min(1).max(120),
  mode: z.enum(['auto', 'bicycle', 'pedestrian', 'taxi', 'bus']).default('auto')
};

const IsochroneInputSchema = z.object(IsochroneInputRawShape);



export function setupIsochroneTool(server: McpServer, valhallaClient: ValhallaClient): void {
  server.registerTool(
    "isochrone",
    {
      title: "Generate Isochrone",
      description: "Generate an isochrone polygon showing areas reachable within a specified travel time from a given point.",
      inputSchema: IsochroneInputRawShape
    },
    async (args: any, extra: any) => {
      try {
        logger.info("Isochrone tool called with args:", JSON.stringify(args));
        
        // args should now contain the validated parameters from input schema
        const input = args;
        
        logger.info(`Generating ${input.minutes}-minute isochrone from [${input.origin.lat}, ${input.origin.lon}] using ${input.mode}`);
        
        // Prepare Valhalla request
        const valhallaRequest: IsochroneRequest = {
          locations: [
            { lat: input.origin.lat, lon: input.origin.lon }
          ],
          costing: input.mode,
          contours: [
            { time: input.minutes, color: "ff0000" }
          ],
          polygons: true
        };

        // Make request to Valhalla
        const response = await valhallaClient.isochrone(valhallaRequest);
        
        // The response should be a GeoJSON FeatureCollection with Polygon features
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(response, null, 2)
            }
          ]
        };

      } catch (error) {
        logger.error("Isochrone generation failed:", error);
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                error: "Failed to generate isochrone",
                message: error instanceof Error ? error.message : "Unknown error",
                type: "isochrone_error"
              }, null, 2)
            }
          ],
          isError: true
        };
      }
    }
  );

  logger.info("Isochrone tool registered");
} 