export type TransportDirection = "PICKUP" | "DROP" | "BOTH";
export type SubscriptionStatus = "ACTIVE" | "CANCELLED";

export const DIRECTION_LABEL: Record<TransportDirection, string> = {
  PICKUP: "Ramassage",
  DROP: "Dépose",
  BOTH: "Aller-retour",
};

export const SUB_STATUS_LABEL: Record<SubscriptionStatus, string> = {
  ACTIVE: "Actif",
  CANCELLED: "Résilié",
};

export interface TransportRoute {
  id: number;
  name: string;
  description: string | null;
  vehicleRegistration: string | null;
  driverName: string | null;
  driverPhone: string | null;
  capacity: number | null;
  monthlyFee: number | null;
  active: boolean;
}

export interface TransportStop {
  id: number;
  routeId: number;
  name: string;
  pickupTime: string | null;
  dropTime: string | null;
  sequence: number;
}

export interface TransportSubscription {
  id: number;
  routeId: number;
  stopId: number | null;
  studentId: number;
  direction: TransportDirection;
  startDate: string | null;
  monthlyFee: number | null;
  status: SubscriptionStatus;
}

export interface RouteInput {
  name: string;
  description?: string | null;
  vehicleRegistration?: string | null;
  driverName?: string | null;
  driverPhone?: string | null;
  capacity?: number | null;
  monthlyFee?: number | null;
  active?: boolean;
}
