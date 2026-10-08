export type SearchInput = {
  origin: string;
  destination: string;
  dateFrom: string;
  dateTo: string;
  minNights: number;
  maxNights: number;
  travellers: number;
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
};
