import Foundation

struct SearchHistoryItem: Codable, Identifiable, Equatable {
    var id: String
    var searchedAt: Date
    var search: FareSearch
    var offers: [FlightOffer]
    var checked: Int
    var total: Int
}

struct SavedSearchItem: Codable, Identifiable, Equatable {
    var id: String
    var createdAt: Date
    var search: FareSearch
}

struct SearchAllowance: Decodable {
    var requestsRemaining: Int
    var keySource: String
}

struct ProviderKeyStatus: Decodable {
    var configured: Bool
    var usageRemaining: Int?
}
