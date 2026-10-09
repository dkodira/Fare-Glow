export type SearchInput = {
  origin: string;
  destination: string;
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
