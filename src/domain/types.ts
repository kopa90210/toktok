export type UserRole = 'passenger' | 'driver' | 'admin';

export type RideState =
  | 'requested'
  | 'offers_open'
  | 'driver_selected'
  | 'driver_arriving'
  | 'driver_arrived'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'expired'
  | 'no_driver';

export type OfferState =
  | 'submitted'
  | 'selected'
  | 'rejected'
  | 'withdrawn'
  | 'expired';

export type DriverApplicationStatus =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'approved'
  | 'rejected';

export interface LatLng {
  lat: number;
  lng: number;
}

export interface MapPoint {
  id?: string;
  name: string;
  area: string;
  coords: LatLng;
  isDemoLandmark?: boolean;
}

export interface Landmark extends MapPoint {
  id: string;
  category: 'station' | 'market' | 'hospital' | 'university' | 'tourism' | 'neighborhood' | 'out_of_zone';
}

export interface ServiceZone {
  id: string;
  name: string;
  center: LatLng;
  radiusKm: number;
}

export interface FareConfig {
  baseFareEgp: number;
  perKmEgp: number;
  minFareEgp: number;
  maxSuggestedEgp: number;
  offerLifetimeSeconds: number;
}

export interface PassengerProfile {
  id: string;
  name: string;
  phone: string;
  city: 'أسوان';
  avatarUrl?: string;
  createdAt: string;
  totalTrips: number;
}

export interface DriverDocument {
  type: 'driver_license' | 'vehicle_license';
  label: string;
  mockFileName: string;
  uploadedAt: string;
}

export interface DriverProfile {
  id: string;
  name: string;
  phone: string;
  avatarUrl?: string;
  vehicleType: 'توكتوك';
  vehicleCode: string;
  applicationStatus: DriverApplicationStatus;
  rejectionReason?: string;
  documents: DriverDocument[];
  isOnline: boolean;
  rating: number | null;
  ratingCount: number;
  completedTrips: number;
  estimatedEarningsEgp: number;
  currentCoords: LatLng;
  createdAt: string;
}

export interface DriverOffer {
  id: string;
  rideId: string;
  driverId: string;
  driverName: string;
  driverAvatarUrl?: string;
  driverRating: number | null;
  driverTripCount: number;
  vehicleCode: string;
  priceEgp: number;
  etaMinutes: number;
  state: OfferState;
  isCounterOffer: boolean;
  isSimulated: boolean;
  createdAt: number;
  expiresAt: number;
}

export interface RideRating {
  stars: number;
  reason?: string;
  submittedAt: string;
}

export interface RideRequest {
  id: string;
  passengerId: string;
  passengerName: string;
  passengerPhone: string;
  pickup: MapPoint;
  destination: MapPoint;
  distanceKm: number;
  estimatedMinutes: number;
  suggestedFareEgp: number;
  passengerFareEgp: number;
  agreedFareEgp?: number;
  paymentMethod: 'cash';
  notes?: string;
  state: RideState;
  selectedDriverId?: string;
  selectedOfferId?: string;
  tripStartOtp: string;
  driverProgressPct: number;
  cancelReason?: string;
  cancelledBy?: 'passenger' | 'driver' | 'admin' | 'system';
  rating?: RideRating;
  createdAt: number;
  updatedAt: number;
}

export interface RideReport {
  id: string;
  rideId: string;
  reporterRole: 'passenger' | 'driver';
  reporterName: string;
  category: string;
  details: string;
  status: 'open' | 'reviewed';
  createdAt: string;
}

export interface AdminAuditEntry {
  id: string;
  action: string;
  targetId: string;
  details: string;
  timestamp: string;
}

export interface DemoSimulationFlags {
  locationPermissionDenied: boolean;
  gpsUnavailable: boolean;
  networkOffline: boolean;
  forceNoDrivers: boolean;
  fastOfferExpiry: boolean;
}

export interface DemoStoreState {
  activeRole: UserRole;
  activePassengerId: string;
  activeDriverId: string;
  passengerOnboardingStep: 'welcome' | 'phone' | 'verify' | 'profile' | 'done';
  driverOnboardingStep: 'phone' | 'verify' | 'profile' | 'status' | 'done';
  passengers: PassengerProfile[];
  drivers: DriverProfile[];
  rides: RideRequest[];
  offers: DriverOffer[];
  reports: RideReport[];
  auditLogs: AdminAuditEntry[];
  serviceZone: ServiceZone;
  fareConfig: FareConfig;
  simulationFlags: DemoSimulationFlags;
}
