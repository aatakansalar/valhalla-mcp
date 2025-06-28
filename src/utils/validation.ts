import { z } from 'zod';

// Enhanced coordinate validation
export const coordinateSchema = z.object({
  lat: z.number()
    .min(-90, 'Latitude must be between -90 and 90')
    .max(90, 'Latitude must be between -90 and 90')
    .refine(val => !isNaN(val), 'Latitude must be a valid number'),
  lon: z.number()
    .min(-180, 'Longitude must be between -180 and 180')
    .max(180, 'Longitude must be between -180 and 180')
    .refine(val => !isNaN(val), 'Longitude must be a valid number')
});

// Location with type validation
export const locationSchema = z.object({
  lat: coordinateSchema.shape.lat,
  lon: coordinateSchema.shape.lon,
  type: z.enum(['break', 'through', 'via', 'break_through']).optional()
});

// Costing model validation
export const costingSchema = z.enum(['auto', 'bicycle', 'pedestrian', 'taxi', 'bus'], {
  errorMap: () => ({ message: 'Costing must be one of: auto, bicycle, pedestrian, taxi, bus' })
});

// Enhanced route request validation
export const routeRequestSchema = z.object({
  locations: z.array(locationSchema)
    .min(2, 'At least 2 locations required for routing')
    .max(20, 'Maximum 20 locations allowed'),
  costing: costingSchema,
  costing_options: z.record(z.any()).optional(),
  directions_options: z.object({
    units: z.enum(['kilometers', 'miles']).optional(),
    language: z.string().min(2).max(5).optional(),
    narrative: z.boolean().optional()
  }).optional(),
  filters: z.object({
    attributes: z.array(z.string()).optional(),
    action: z.enum(['include', 'exclude']).optional()
  }).optional(),
  alternates: z.number().min(0).max(5).optional()
}).strict();

// Enhanced isochrone request validation
export const isochroneRequestSchema = z.object({
  locations: z.array(coordinateSchema)
    .min(1, 'At least 1 location required for isochrone')
    .max(5, 'Maximum 5 locations allowed for isochrones'),
  costing: costingSchema,
  contours: z.array(z.object({
    time: z.number().min(1).max(120).optional(), // 1-120 minutes
    distance: z.number().min(0.1).max(100).optional(), // 0.1-100 km
    color: z.string().regex(/^[0-9a-fA-F]{6}$/, 'Color must be 6-digit hex (without #)').optional()
  }).refine(
    data => (data.time !== undefined) !== (data.distance !== undefined),
    { message: 'Either time OR distance must be specified, not both' }
  ))
    .min(1, 'At least 1 contour required')
    .max(4, 'Maximum 4 contours allowed'),
  polygons: z.boolean().optional(),
  denoise: z.number().min(0).max(1).optional(),
  generalize: z.number().min(0).max(1000).optional() // meters
}).strict();

// Tile request validation
export const tileRequestSchema = z.object({
  z: z.number().int().min(0).max(18, 'Zoom level must be between 0 and 18'),
  x: z.number().int().min(0),
  y: z.number().int().min(0)
}).refine(data => {
  const maxTile = Math.pow(2, data.z) - 1;
  return data.x <= maxTile && data.y <= maxTile;
}, {
  message: 'Invalid tile coordinates for zoom level'
});

// Validation utility functions
export function validateAndSanitize<T>(schema: z.ZodSchema<T>, data: unknown): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.issues.map(issue => ({
        path: issue.path.join('.'),
        message: issue.message,
        code: issue.code
      }));
      throw new ValidationError('Invalid input data', issues);
    }
    throw error;
  }
}

export class ValidationError extends Error {
  public readonly issues: Array<{
    path: string;
    message: string;
    code: string;
  }>;

  constructor(message: string, issues: Array<{ path: string; message: string; code: string }>) {
    super(message);
    this.name = 'ValidationError';
    this.issues = issues;
  }
} 