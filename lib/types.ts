export const FARE_CURRENCIES = [
  { code: "CAD", name: "Canadian Dollar" },
  { code: "USD", name: "US Dollar" },
  { code: "EUR", name: "Euro" },
  { code: "GBP", name: "British Pound" },
  { code: "INR", name: "Indian Rupee" },
  { code: "AUD", name: "Australian Dollar" },
  { code: "JPY", name: "Japanese Yen" },
  { code: "MXN", name: "Mexican Peso" },
  { code: "CNY", name: "Chinese Yuan" },
  { code: "SGD", name: "Singapore Dollar" },
] as const;

export type FareCurrency = (typeof FARE_CURRENCIES)[number]["code"];

export type SearchInput = {
  origin: string;
  destination: string;
  currency: FareCurrency;
  dateFrom: string;
  dateTo: string;
  minNights: number;
  maxNights: number;
  travellers: number;
  advanced?: AdvancedFilters;
};

export type AdvancedFilters = {
  stops: "any" | "nonstop" | "one" | "two";
  carryOn: number;
  airlineMode: "any" | "include" | "exclude";
  airlines: string[];
  maxPrice: string;
  outboundTime: string;
  returnTime: string;
  maxDuration: number;
  layover: string;
  excludedAirports: string[];
  cabin: number;
  sortBy: number;
  lowEmissions: boolean;
};

export type FlightOffer = {
  id: string;
  departureDate: string;
  returnDate: string;
  price: number;
  outboundTime: string;
  outboundStops: number;
  duration: string;
  source: string;
  bookingUrl?: string;
  arrivalTime?: string;
  durationMinutes?: number;
  emissionsGrams?: number;
};
