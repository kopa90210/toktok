import {
  DemoStoreState,
  FareConfig,
  Landmark,
  LatLng,
  MapPoint,
  ServiceZone,
} from '../domain/types';

export interface RouteEstimate {
  distanceKm: number;
  etaMinutes: number;
  polyline: LatLng[];
  isSimulated: boolean;
}

export interface IMapProvider {
  readonly providerName: string;
  readonly isConfigured: boolean;
  searchLandmarks(query: string): Landmark[];
  getAllLandmarks(): Landmark[];
  getCurrentLocation(options: {
    permissionDenied: boolean;
    gpsUnavailable: boolean;
  }): Promise<{ ok: true; point: MapPoint } | { ok: false; reason: 'permission_denied' | 'gps_unavailable'; message: string }>;
  estimateRoute(pickup: MapPoint, destination: MapPoint): RouteEstimate;
  isWithinZone(coords: LatLng, zone: ServiceZone): boolean;
  getSuggestedFare(distanceKm: number, fareConfig: FareConfig): number;
  getConfigInstructions(): string[];
}

export interface OtpSendResult {
  ok: boolean;
  demoOtpCode?: string;
  error?: string;
  isDemoMode: boolean;
}

export interface OtpVerifyResult {
  ok: boolean;
  error?: string;
}

export interface IAuthProvider {
  readonly isDemoMode: boolean;
  sendOtp(phone: string): Promise<OtpSendResult>;
  verifyOtp(phone: string, code: string): Promise<OtpVerifyResult>;
  getActiveDemoOtp(phone: string): string | null;
}

export interface IStorageProvider {
  loadState(): DemoStoreState | null;
  saveState(state: DemoStoreState): void;
  clearState(): void;
}
