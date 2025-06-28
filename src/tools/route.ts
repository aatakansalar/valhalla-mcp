import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ValhallaClient, RouteRequest } from "../clients/valhalla.js";
import { logger } from "../utils/logger.js";
import { routeCache } from "../utils/cache.js";
import { validateAndSanitize } from "../utils/validation.js";
import { handleError, generateRequestId } from "../utils/errors.js";
import { metrics, measureTime } from "../utils/metrics.js";

// Input schema for route tool - using Zod for validation
const RouteInputRawShape = {
  origin: z.object({
    lat: z.number().min(-90).max(90),
    lon: z.number().min(-180).max(180)
  }),
  destination: z.object({
    lat: z.number().min(-90).max(90),
    lon: z.number().min(-180).max(180)
  }),
  mode: z.enum(['auto', 'bicycle', 'pedestrian', 'taxi', 'bus']).default('auto'),
  alternatives: z.number().min(0).max(5).optional(),
  units: z.enum(['kilometers', 'miles']).default('kilometers').optional()
};

const RouteInputSchema = z.object(RouteInputRawShape);



export function setupRouteTool(server: McpServer, valhallaClient: ValhallaClient): void {
  server.registerTool(
    "route",
    {
      title: "Calculate Route", 
      description: "Calculate a route between two points using Valhalla routing engine. Returns GeoJSON LineString with summary statistics.",
      inputSchema: RouteInputRawShape
    },
    async (args: any, _extra: any): Promise<any> => {
      const requestId = generateRequestId();
      const startTime = Date.now();

      try {
        // Enhanced validation with better error messages
        const input = validateAndSanitize(RouteInputSchema, args);
        
        logger.info("Route tool called", { 
          requestId,
          origin: input.origin,
          destination: input.destination,
          mode: input.mode
        });
        
        // Generate cache key
        const cacheKey = `route:${input.origin.lat},${input.origin.lon}:${input.destination.lat},${input.destination.lon}:${input.mode}:${input.units || 'kilometers'}:${input.alternatives || 0}`;
        
        // Check cache first
        const cachedResult = routeCache.get(cacheKey);
        if (cachedResult) {
          metrics.recordCacheHit();
          metrics.recordRequest({
            endpoint: '/route',
            method: 'POST',
            duration: Date.now() - startTime,
            success: true,
            timestamp: Date.now(),
            requestId
          });
          
          logger.info("Route served from cache", { requestId, cacheKey });
          return cachedResult;
        }
        
        metrics.recordCacheMiss();
        
        // Prepare Valhalla request
        const valhallaRequest: RouteRequest = {
          locations: [
            { lat: input.origin.lat, lon: input.origin.lon, type: 'break' },
            { lat: input.destination.lat, lon: input.destination.lon, type: 'break' }
          ],
          costing: input.mode || 'auto',
          directions_options: {
            units: input.units || 'kilometers',
            narrative: true
          }
        };

        if (input.alternatives && input.alternatives > 0) {
          valhallaRequest.alternates = input.alternatives;
        }

        // Make request to Valhalla with performance measurement
        const { result: response, duration: apiDuration } = await measureTime(
          () => valhallaClient.route(valhallaRequest)
        );
        
        // Check if response has valid trip data
        if (!response.trip || !response.trip.legs || response.trip.legs.length === 0 || !response.trip.legs[0].shape) {
          throw new Error("Valhalla returned no route - check coordinates are within map data coverage");
        }
        
        // Decode polyline to coordinates (shape is in first leg)
        const coordinates = ValhallaClient.decodePolyline(response.trip.legs[0].shape);
        const geoJsonCoords = coordinates.map(([lat, lon]) => [lon, lat]);
        
        // Create GeoJSON response
        const geoJson = {
          type: "FeatureCollection" as const,
          features: [
            {
              type: "Feature" as const,
              geometry: {
                type: "LineString" as const,
                coordinates: geoJsonCoords // GeoJSON uses [lon, lat]
              },
              properties: {
                distance_km: response.trip.summary.length,
                duration_seconds: response.trip.summary.time,
                duration_minutes: Math.round(response.trip.summary.time / 60),
                units: input.units || 'kilometers',
                mode: input.mode,
                bbox: [
                  response.trip.summary.min_lon,
                  response.trip.summary.min_lat,
                  response.trip.summary.max_lon,
                  response.trip.summary.max_lat
                ],
                requestId,
                cached: false,
                valhalla_duration_ms: apiDuration
              }
            }
          ]
        };

        // Add alternatives if requested
        const alternatives = [];
        if (response.alternates && response.alternates.length > 0) {
          for (const alt of response.alternates) {
            if (alt.trip && alt.trip.legs && alt.trip.legs.length > 0 && alt.trip.legs[0].shape) {
              const altCoords = ValhallaClient.decodePolyline(alt.trip.legs[0].shape);
              const altGeoJsonCoords = altCoords.map(([lat, lon]) => [lon, lat]);
              alternatives.push({
                type: "Feature" as const,
                geometry: {
                  type: "LineString" as const,
                  coordinates: altGeoJsonCoords
                },
                properties: {
                  distance_km: alt.trip.summary.length,
                  duration_seconds: alt.trip.summary.time,
                  duration_minutes: Math.round(alt.trip.summary.time / 60),
                  alternative: true
                }
              });
            }
          }
        }

        const result = {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                ...geoJson,
                features: [...geoJson.features, ...alternatives]
              }, null, 2)
            }
          ]
        };

        // Cache the result (TTL is handled by cache instance)
        routeCache.set(cacheKey, result);

        // Record successful metrics
        metrics.recordRequest({
          endpoint: '/route',
          method: 'POST',
          duration: Date.now() - startTime,
          success: true,
          timestamp: Date.now(),
          requestId
        });

        logger.info("Route calculation completed", {
          requestId,
          distance: response.trip.summary.length,
          duration: response.trip.summary.time,
          apiDuration,
          cached: false
        });

        return result;

      } catch (error: any) {
        // Record failed request metrics
        metrics.recordRequest({
          endpoint: '/route',
          method: 'POST',
          duration: Date.now() - startTime,
          success: false,
          timestamp: Date.now(),
          requestId,
          errorCode: error?.code || 500
        });

        logger.error("Route calculation failed", { 
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

  logger.info("Route tool registered");
} 