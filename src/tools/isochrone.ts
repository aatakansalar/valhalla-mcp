import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ValhallaClient, IsochroneRequest } from "../clients/valhalla.js";
import { logger } from "../utils/logger.js";
import { isochroneCache } from "../utils/cache.js";
import { validateAndSanitize } from "../utils/validation.js";
import { handleError, generateRequestId } from "../utils/errors.js";
import { metrics, measureTime } from "../utils/metrics.js";

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
    async (args: any, _extra: any): Promise<any> => {
      const requestId = generateRequestId();
      const startTime = Date.now();

      try {
        // Enhanced validation
        const input = validateAndSanitize(IsochroneInputSchema, args);
        
        logger.info("Isochrone tool called", { 
          requestId,
          origin: input.origin,
          minutes: input.minutes,
          mode: input.mode
        });
        
        // Generate cache key
        const cacheKey = `isochrone:${input.origin.lat},${input.origin.lon}:${input.minutes}:${input.mode}`;
        
        // Check cache first
        const cachedResult = isochroneCache.get(cacheKey);
        if (cachedResult) {
          metrics.recordCacheHit();
          metrics.recordRequest({
            endpoint: '/isochrone',
            method: 'POST',
            duration: Date.now() - startTime,
            success: true,
            timestamp: Date.now(),
            requestId
          });
          
          logger.info("Isochrone served from cache", { requestId, cacheKey });
          return cachedResult;
        }
        
        metrics.recordCacheMiss();
        
        // Prepare Valhalla request
        const valhallaRequest: IsochroneRequest = {
          locations: [
            { lat: input.origin.lat, lon: input.origin.lon }
          ],
          costing: input.mode || 'auto',
          contours: [
            { time: input.minutes, color: "ff0000" }
          ],
          polygons: true
        };

        // Make request to Valhalla with performance measurement
        const { result: response, duration: apiDuration } = await measureTime(
          () => valhallaClient.isochrone(valhallaRequest)
        );
        
        // Add metadata to response
        const enhancedResponse = {
          ...response,
          metadata: {
            requestId,
            cached: false,
            valhalla_duration_ms: apiDuration,
            minutes: input.minutes,
            mode: input.mode,
            origin: input.origin
          }
        };

        const result = {
          content: [
            {
              type: "text",
              text: JSON.stringify(enhancedResponse, null, 2)
            }
          ]
        };

        // Cache the result
        isochroneCache.set(cacheKey, result);

        // Record successful metrics
        metrics.recordRequest({
          endpoint: '/isochrone',
          method: 'POST',
          duration: Date.now() - startTime,
          success: true,
          timestamp: Date.now(),
          requestId
        });

        logger.info("Isochrone generation completed", {
          requestId,
          minutes: input.minutes,
          apiDuration,
          cached: false
        });

        return result;

      } catch (error: any) {
        // Record failed request metrics
        metrics.recordRequest({
          endpoint: '/isochrone',
          method: 'POST',
          duration: Date.now() - startTime,
          success: false,
          timestamp: Date.now(),
          requestId,
          errorCode: error?.code || 500
        });

        logger.error("Isochrone generation failed", { 
          requestId,
          error: error?.message || 'Unknown error',
          stack: error?.stack 
        });
        
        const errorResponse = handleError(error, requestId);
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(errorResponse, null, 2)
            }
          ],
          isError: true
        };
      }
    }
  );

  logger.info("Isochrone tool registered");
} 