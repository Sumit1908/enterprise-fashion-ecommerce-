/**
 * Typed shapes for the Shiprocket External API (apiv2.shiprocket.in/v1/external).
 * Only the fields this integration consumes are modelled; unknown fields are
 * tolerated. Reference: https://apidocs.shiprocket.in/
 */

export interface SrLoginResponse {
  token: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  company_id?: number;
  created_at?: string;
}

export interface SrCourier {
  courier_company_id: number;
  courier_name: string;
  rate: number;
  etd?: string;
  estimated_delivery_days?: string;
  rating?: number;
  is_surface?: boolean;
  cod?: number | boolean;
  call_before_delivery?: string;
  blocked?: number;
}

export interface SrServiceabilityResponse {
  status?: number;
  data?: {
    available_courier_companies?: SrCourier[];
    recommended_courier_company_id?: number;
    recommended_by?: { id?: number; title?: string };
    is_recommendation_enabled?: number;
  };
  message?: string;
}

export interface SrCreateOrderResponse {
  order_id?: number;
  shipment_id?: number;
  status?: string;
  status_code?: number;
  onboarding_completed_now?: number;
  awb_code?: string | null;
  courier_company_id?: number | null;
  courier_name?: string | null;
  packages_created?: number;
  message?: string;
  errors?: Record<string, string[]> | string[];
}

export interface SrAwbResponse {
  awb_assign_status?: number;
  response?: {
    data?: {
      courier_company_id?: number;
      awb_code?: string;
      courier_name?: string;
      applied_weight?: number;
      shipment_id?: number;
      freight_charges?: number;
      routing_code?: string;
      invoice_no?: string;
      transporter_id?: string;
      transporter_name?: string;
    };
  };
  message?: string;
  not_serviceable?: string[];
}

export interface SrPickupResponse {
  pickup_status?: number;
  response?: {
    pickup_scheduled_date?: string;
    pickup_token_number?: string | number;
    status?: number;
    pickup_generated_date?: { date?: string };
    data?: string;
  };
  message?: string;
}

export interface SrLabelResponse {
  label_created?: number;
  label_url?: string;
  response?: string;
  not_created?: unknown[];
}

export interface SrInvoiceResponse {
  is_invoice_created?: boolean;
  invoice_url?: string;
  not_created?: unknown[];
}

export interface SrManifestResponse {
  status?: number;
  manifest_url?: string;
}

export interface SrTrackActivity {
  date?: string;
  status?: string;
  activity?: string;
  location?: string;
  'sr-status'?: string;
  'sr-status-label'?: string;
}

export interface SrTrackingResponse {
  tracking_data?: {
    track_status?: number;
    shipment_status?: number;
    shipment_track?: Array<{
      id?: number;
      awb_code?: string;
      courier_name?: string;
      current_status?: string;
      delivered_date?: string | null;
      destination?: string;
      edd?: string | null;
      pickup_date?: string | null;
    }>;
    shipment_track_activities?: SrTrackActivity[];
    track_url?: string;
    etd?: string;
    error?: string;
  };
}

export interface SrCancelResponse {
  status_code?: number;
  status?: number;
  message?: string;
}

export interface SrPickupAddress {
  id?: number;
  pickup_location?: string;
  address?: string;
  address_2?: string;
  city?: string;
  state?: string;
  country?: string;
  pin_code?: string;
  email?: string;
  phone?: string;
  name?: string;
  status?: number;
  phone_verified?: number;
}

export interface SrPickupListResponse {
  data?: { shipping_address?: SrPickupAddress[] };
}

/** Payload for POST /orders/create/adhoc */
export interface SrCreateOrderPayload {
  order_id: string;
  order_date: string;
  pickup_location: string;
  channel_id?: string;
  comment?: string;
  billing_customer_name: string;
  billing_last_name: string;
  billing_address: string;
  billing_address_2?: string;
  billing_city: string;
  billing_pincode: string;
  billing_state: string;
  billing_country: string;
  billing_email: string;
  billing_phone: string;
  shipping_is_billing: boolean;
  order_items: Array<{
    name: string;
    sku: string;
    units: number;
    selling_price: number;
    discount?: number;
    tax?: number;
    hsn?: number | string;
  }>;
  payment_method: 'Prepaid' | 'COD';
  shipping_charges?: number;
  total_discount?: number;
  sub_total: number;
  length: number;
  breadth: number;
  height: number;
  weight: number;
}

/** Body Shiprocket POSTs to the tracking webhook. */
export interface SrWebhookBody {
  awb?: string | number;
  current_status?: string;
  current_status_id?: number;
  shipment_status?: string;
  shipment_status_id?: number;
  order_id?: string;
  sr_order_id?: number | string;
  channel_order_id?: string;
  current_timestamp?: string;
  etd?: string;
  courier_name?: string;
  scans?: Array<{
    location?: string;
    date?: string;
    activity?: string;
    'sr-status'?: string | number;
    'sr-status-label'?: string;
  }>;
}

export class ShiprocketError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = 'ShiprocketError';
  }
}
