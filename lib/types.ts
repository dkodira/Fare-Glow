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

export const DEFAULT_PAIRS_PER_REQUEST = 8;
export const MAX_SEARCH_API_CHUNK = 8;

export type SearchInput = {
  origin: string;
  destination: string;
  /** Full selected destination list. Missing on older saved searches; destination remains the legacy first value. */
  destinations?: string[];
  currency: FareCurrency;
  dateFrom: string;
  dateTo: string;
  minNights: number;
  maxNights: number;
  travellers: number;
  pairsPerRequest?: number;
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
  /** Destination airport label used to group multi-destination results. */
  destination?: string;
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

/** A destination-matched Google Flights deal, separate from sampled route fares. */
export type FlightDeal = {
  destinationCode: string;
  destinationName: string;
  country?: string;
  price: number;
  averagePrice: number;
  discountPercentage: number;
  startDate?: string;
  endDate?: string;
  airline?: string;
  stops?: number;
  flightDurationMinutes?: number;
  flightLink: string;
};
