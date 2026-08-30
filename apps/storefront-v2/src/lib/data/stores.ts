import { img, PHOTOS } from '@/lib/images';

export interface StoreData {
  city: string;
  address: string;
  phone: string;
  image: string;
}

const S = [
  PHOTOS.store1,
  PHOTOS.store2,
  PHOTOS.store3,
  PHOTOS.model6,
  PHOTOS.model4,
  PHOTOS.model1,
];

export const STORES: StoreData[] = [
  { city: 'Delhi', address: 'Select Citywalk, Saket' },
  { city: 'Mumbai', address: 'Phoenix Palladium, Lower Parel' },
  { city: 'Bangalore', address: 'UB City Mall, Vittal Mallya Road' },
  { city: 'Hyderabad', address: 'Inorbit Mall, Madhapur' },
  { city: 'Pune', address: 'Phoenix Marketcity, Viman Nagar' },
  { city: 'Chandigarh', address: 'Elante Mall, Industrial Area' },
].map((s, i) => ({
  city: s.city,
  address: s.address,
  phone: '+91 98XXX XXXXX',
  image: img(S[i % S.length]!, 700),
}));
