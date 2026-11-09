import Foundation

struct FlightOffer: Codable, Identifiable, Equatable {
    var id: String
    var departureDate: String
    var returnDate: String
    var price: Int
    var outboundTime: String
    var outboundStops: Int
    var duration: String
    var source: String
    var bookingUrl: URL?
    var arrivalTime: String?
    var durationMinutes: Int?
    var emissionsGrams: Double?

    enum CodingKeys: String, CodingKey {
        case id, departureDate, returnDate, price, outboundTime, outboundStops, duration, source
        case bookingUrl, arrivalTime, durationMinutes, emissionsGrams
    }
}

struct SearchChunk: Decodable {
    var offers: [FlightOffer]
    var checked: Int
    var totalCandidates: Int
    var nextOffset: Int
    var moreAvailable: Bool
    var budgetReached: Bool
    var usageRemaining: Int?
    var keySource: String?
}
