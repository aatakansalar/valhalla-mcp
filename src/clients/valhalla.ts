import axios, { AxiosInstance, AxiosResponse } from 'axios';

export interface RouteRequest {
  locations: Array<{
    lat: number;
    lon: number;
    type?: 'break' | 'through' | 'via' | 'break_through';
  }>;
  costing: 'auto' | 'bicycle' | 'pedestrian' | 'taxi' | 'bus';
  costing_options?: Record<string, any>;
  directions_options?: {
    units?: 'kilometers' | 'miles';
    language?: string;
    narrative?: boolean;
  };
  filters?: {
    attributes?: string[];
    action?: 'include' | 'exclude';
  };
  alternates?: number;
}

export interface RouteResponse {
  trip: {
    legs: Array<{
      shape: string;
      summary: {
        time: number;
        length: number;
        min_lat: number;
        min_lon: number;
        max_lat: number;
        max_lon: number;
      };
      maneuvers?: Array<{
        type: number;
        instruction: string;
        verbal_transition_alert_instruction?: string;
        verbal_pre_transition_instruction?: string;
        verbal_post_transition_instruction?: string;
        street_names?: string[];
        time: number;
        length: number;
        begin_shape_index: number;
        end_shape_index: number;
      }>;
    }>;
    summary: {
      time: number;
      length: number;
      min_lat: number;
      min_lon: number;
      max_lat: number;
      max_lon: number;
    };
    status_message: string;
    status: number;
    units: string;
    shape: string;
  };
  alternates?: any[];
}

export interface IsochroneRequest {
  locations: Array<{
    lat: number;
    lon: number;
  }>;
  costing: 'auto' | 'bicycle' | 'pedestrian' | 'taxi' | 'bus';
  contours: Array<{
    time?: number;
    distance?: number;
    color?: string;
  }>;
  polygons?: boolean;
  denoise?: number;
  generalize?: number;
}

export interface IsochroneResponse {
  features: Array<{
    type: 'Feature';
    properties: {
      contour: number;
      color: string;
      fill: string;
      'fill-opacity': number;
      stroke: string;
      'stroke-opacity': number;
      'stroke-width': number;
    };
    geometry: {
      type: 'Polygon';
      coordinates: number[][][];
    };
  }>;
  type: 'FeatureCollection';
}

export interface HealthResponse {
  version: string;
  tileset_last_modified: number;
  available_actions: string[];
  has_transit_tiles: boolean;
  has_admins: boolean;
  has_timezones: boolean;
  has_live_traffic: boolean;
}

export class ValhallaClient {
  private client: AxiosInstance;

  constructor(baseUrl: string) {
    this.client = axios.create({
      baseURL: baseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  async route(request: RouteRequest): Promise<RouteResponse> {
    const response: AxiosResponse<RouteResponse> = await this.client.post('/route', request);
    return response.data;
  }

  async isochrone(request: IsochroneRequest): Promise<IsochroneResponse> {
    const response: AxiosResponse<IsochroneResponse> = await this.client.post('/isochrone', request);
    return response.data;
  }

  async health(): Promise<HealthResponse> {
    const response: AxiosResponse<HealthResponse> = await this.client.get('/status');
    return response.data;
  }

  async tile(z: number, x: number, y: number): Promise<Buffer> {
    const response: AxiosResponse<Buffer> = await this.client.get(`/tile/${z}/${x}/${y}.pbf`, {
      responseType: 'arraybuffer',
    });
    return response.data;
  }

  // Utility method to decode polyline
  static decodePolyline(encoded: string): Array<[number, number]> {
    const coords: Array<[number, number]> = [];
    let index = 0;
    let lat = 0;
    let lng = 0;

    while (index < encoded.length) {
      let shift = 0;
      let result = 0;
      let byte: number;

      do {
        byte = encoded.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);

      const deltaLat = ((result & 1) !== 0 ? ~(result >> 1) : (result >> 1));
      lat += deltaLat;

      shift = 0;
      result = 0;

      do {
        byte = encoded.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);

      const deltaLng = ((result & 1) !== 0 ? ~(result >> 1) : (result >> 1));
      lng += deltaLng;

      coords.push([lat / 1e6, lng / 1e6]);
    }

    return coords;
  }
} 