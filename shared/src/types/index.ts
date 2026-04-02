// Shared TypeScript types

export type FuelType = 'petrol' | 'diesel' | 'electric' | 'hybrid';
export type OdometerUnit = 'miles' | 'km';
export type DocumentType = 'service_invoice' | 'mot_certificate' | 'repair_receipt' | 'other';
export type ReminderType = 'mot' | 'service' | 'insurance';

export interface User {
  id: string;
  email: string;
  created_at: string;
}

export interface Vehicle {
  id: string;
  owner_user_id: string;
  vrm?: string;
  make?: string;
  model?: string;
  year?: number;
  fuel_type_default: FuelType;
  odometer_unit_default: OdometerUnit;
  created_at: string;
  updated_at: string;
}

export interface Document {
  id: string;
  vehicle_id: string;
  type: DocumentType;
  file_url: string;
  occurred_at: string;
  notes?: string;
  created_at: string;
}

export interface HealthScan {
  id: string;
  vehicle_id: string;
  scan_at: string;
  tyre_photo_url?: string;
  exterior_photo_url?: string;
  dashboard_photo_url?: string;
  odometer_reading: number;
  odometer_unit: OdometerUnit;
  warning_lights: boolean;
  new_noises: boolean;
  generated_advice?: string;
  created_at: string;
}

export interface FuelEntry {
  id: string;
  vehicle_id: string;
  occurred_at: string;
  odometer_reading: number;
  odometer_unit: OdometerUnit;
  litres_added: number;
  is_full_tank: boolean;
  total_cost_gbp: number;
  price_pence_per_litre: number;
  fuel_type: FuelType;
  town_pct: number; // 0-100
  notes?: string;
  created_at: string;
}

export interface Reminder {
  id: string;
  vehicle_id: string;
  type: ReminderType;
  due_date: string;
  is_completed: boolean;
  notes?: string;
  created_at: string;
}

export interface FuelStats {
  rolling_mpg?: number;
  l_per_100km?: number;
  cost_per_mile?: number;
  total_distance_miles?: number;
  total_distance_km?: number;
  total_litres?: number;
  total_cost_gbp?: number;
}

export interface FuelInterval {
  start_entry: FuelEntry;
  end_entry: FuelEntry;
  litres_total: number;
  distance_miles: number;
  distance_km: number;
  mpg: number;
  l_per_100km: number;
  cost_per_mile: number;
  /** Sum of total_cost_gbp for all fill-ups within this interval (start_entry through end_entry inclusive). */
  total_cost_gbp: number;
}
