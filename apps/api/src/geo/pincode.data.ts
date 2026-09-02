/**
 * Small offline PIN-code fallback.
 *
 * Used only when the India Post lookup is unreachable AND the PIN has never been
 * cached. It lets local dev / CI (and a brief upstream outage) resolve the
 * common metro PINs instead of failing the check. It is NOT a substitute for the
 * live lookup — real coverage is ~19k PINs and comes from the API + DB cache.
 */
export interface PincodeRecord {
  city: string;
  district: string;
  state: string;
}

export const PINCODE_FALLBACK: Record<string, PincodeRecord> = {
  '110001': { city: 'New Delhi', district: 'Central Delhi', state: 'Delhi' },
  '110020': { city: 'New Delhi', district: 'South Delhi', state: 'Delhi' },
  '110070': { city: 'New Delhi', district: 'South West Delhi', state: 'Delhi' },
  '122001': { city: 'Gurugram', district: 'Gurugram', state: 'Haryana' },
  '201301': { city: 'Noida', district: 'Gautam Buddha Nagar', state: 'Uttar Pradesh' },
  '400001': { city: 'Mumbai', district: 'Mumbai', state: 'Maharashtra' },
  '400050': { city: 'Mumbai', district: 'Mumbai', state: 'Maharashtra' },
  '400076': { city: 'Mumbai', district: 'Mumbai Suburban', state: 'Maharashtra' },
  '411001': { city: 'Pune', district: 'Pune', state: 'Maharashtra' },
  '560001': { city: 'Bengaluru', district: 'Bengaluru', state: 'Karnataka' },
  '560034': { city: 'Bengaluru', district: 'Bengaluru', state: 'Karnataka' },
  '600001': { city: 'Chennai', district: 'Chennai', state: 'Tamil Nadu' },
  '600041': { city: 'Chennai', district: 'Chennai', state: 'Tamil Nadu' },
  '700001': { city: 'Kolkata', district: 'Kolkata', state: 'West Bengal' },
  '700091': { city: 'Kolkata', district: 'North 24 Parganas', state: 'West Bengal' },
  '500001': { city: 'Hyderabad', district: 'Hyderabad', state: 'Telangana' },
  '500081': { city: 'Hyderabad', district: 'K.V.Rangareddy', state: 'Telangana' },
  '380001': { city: 'Ahmedabad', district: 'Ahmedabad', state: 'Gujarat' },
  '302001': { city: 'Jaipur', district: 'Jaipur', state: 'Rajasthan' },
  '226001': { city: 'Lucknow', district: 'Lucknow', state: 'Uttar Pradesh' },
  '230001': { city: 'Pratapgarh', district: 'Pratapgarh', state: 'Uttar Pradesh' },
  '230132': { city: 'Pratapgarh', district: 'Pratapgarh', state: 'Uttar Pradesh' },
  '160017': { city: 'Chandigarh', district: 'Chandigarh', state: 'Chandigarh' },
  '682001': { city: 'Kochi', district: 'Ernakulam', state: 'Kerala' },
  '751001': { city: 'Bhubaneswar', district: 'Khordha', state: 'Odisha' },
  '800001': { city: 'Patna', district: 'Patna', state: 'Bihar' },
};
