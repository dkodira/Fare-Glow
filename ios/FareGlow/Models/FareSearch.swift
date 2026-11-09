import Foundation

struct FareSearch: Codable, Equatable {
    var origin = ""
    var destination = ""
    var currency = "CAD"
    var dateFrom: String
    var dateTo: String
    var minNights = 3
    var maxNights = 10
    var travellers = 1
    var pairsPerRequest = 8
    var advanced = AdvancedFilters()

    init() {
        let calendar = Calendar.current
        let today = calendar.startOfDay(for: Date())
        dateFrom = Self.isoDate(calendar.date(byAdding: .day, value: 28, to: today) ?? today)
        dateTo = Self.isoDate(calendar.date(byAdding: .day, value: 70, to: today) ?? today)
    }

    private enum CodingKeys: String, CodingKey {
        case origin, destination, currency, dateFrom, dateTo, minNights, maxNights, travellers, pairsPerRequest, advanced
    }

    init(from decoder: Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        let fallback = FareSearch()
        origin = try values.decodeIfPresent(String.self, forKey: .origin) ?? ""
        destination = try values.decodeIfPresent(String.self, forKey: .destination) ?? ""
        currency = try values.decodeIfPresent(String.self, forKey: .currency) ?? "CAD"
        dateFrom = try values.decodeIfPresent(String.self, forKey: .dateFrom) ?? fallback.dateFrom
        dateTo = try values.decodeIfPresent(String.self, forKey: .dateTo) ?? fallback.dateTo
        minNights = try values.decodeIfPresent(Int.self, forKey: .minNights) ?? 3
        maxNights = try values.decodeIfPresent(Int.self, forKey: .maxNights) ?? 10
        travellers = try values.decodeIfPresent(Int.self, forKey: .travellers) ?? 1
        pairsPerRequest = try values.decodeIfPresent(Int.self, forKey: .pairsPerRequest) ?? 8
        advanced = try values.decodeIfPresent(AdvancedFilters.self, forKey: .advanced) ?? AdvancedFilters()
    }

    var candidatePairCount: Int {
        guard let start = Self.date(dateFrom), let end = Self.date(dateTo), end >= start,
              minNights >= 1, maxNights >= minNights else { return 0 }
        let span = Calendar(identifier: .gregorian).dateComponents([.day], from: start, to: end).day ?? 0
        return (0...span).reduce(into: 0) { count, departureOffset in
            let longestTripThatFits = span - departureOffset + 1
            let lastLength = min(maxNights, longestTripThatFits)
            if lastLength >= minNights { count += lastLength - minNights + 1 }
        }
    }

    static let currencies = ["CAD", "USD", "EUR", "GBP", "INR", "AUD", "JPY", "MXN", "CNY", "SGD"]
    static func isoDate(_ date: Date) -> String {
        let parts = Calendar(identifier: .gregorian).dateComponents(in: .current, from: date)
        return String(format: "%04d-%02d-%02d", parts.year ?? 2000, parts.month ?? 1, parts.day ?? 1)
    }
    static func date(_ value: String) -> Date? {
        let parts = value.split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3 else { return nil }
        var components = DateComponents()
        components.calendar = Calendar(identifier: .gregorian)
        components.timeZone = .current
        components.year = parts[0]
        components.month = parts[1]
        components.day = parts[2]
        return components.date
    }
}

struct AdvancedFilters: Codable, Equatable {
    var stops = "any"
    var carryOn = 0
    var airlineMode = "any"
    var airlines: [String] = []
    var maxPrice = ""
    var outboundTime = ""
    var returnTime = ""
    var maxDuration = 0
    var layover = ""
    var excludedAirports: [String] = []
    var cabin = 1
    var sortBy = 2
    var lowEmissions = false

    private enum CodingKeys: String, CodingKey {
        case stops, carryOn, airlineMode, airlines, maxPrice, outboundTime, returnTime, maxDuration, layover, excludedAirports, cabin, sortBy, lowEmissions
    }

    init() {}

    init(from decoder: Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        stops = try values.decodeIfPresent(String.self, forKey: .stops) ?? "any"
        carryOn = try values.decodeIfPresent(Int.self, forKey: .carryOn) ?? 0
        airlineMode = try values.decodeIfPresent(String.self, forKey: .airlineMode) ?? "any"
        airlines = try values.decodeIfPresent([String].self, forKey: .airlines) ?? []
        maxPrice = try values.decodeIfPresent(String.self, forKey: .maxPrice) ?? ""
        outboundTime = try values.decodeIfPresent(String.self, forKey: .outboundTime) ?? ""
        returnTime = try values.decodeIfPresent(String.self, forKey: .returnTime) ?? ""
        maxDuration = try values.decodeIfPresent(Int.self, forKey: .maxDuration) ?? 0
        layover = try values.decodeIfPresent(String.self, forKey: .layover) ?? ""
        excludedAirports = try values.decodeIfPresent([String].self, forKey: .excludedAirports) ?? []
        cabin = try values.decodeIfPresent(Int.self, forKey: .cabin) ?? 1
        sortBy = try values.decodeIfPresent(Int.self, forKey: .sortBy) ?? 2
        lowEmissions = try values.decodeIfPresent(Bool.self, forKey: .lowEmissions) ?? false
    }
}

struct Airport: Codable, Identifiable, Hashable {
    var city: String
    var name: String
    var code: String
    var country: String
    var id: String { code }
    var label: String { "\(city) (\(code))" }
}
