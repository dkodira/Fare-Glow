import Foundation

@MainActor
final class FareGlowAPI {
    private let configuration: AppConfiguration
    private let auth: SupabaseService
    private let decoder = JSONDecoder()
    private let encoder = JSONEncoder()

    init(configuration: AppConfiguration, auth: SupabaseService) {
        self.configuration = configuration
        self.auth = auth
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        decoder.dateDecodingStrategy = .custom { decoder in
            let container = try decoder.singleValueContainer()
            let value = try container.decode(String.self)
            let formatter = ISO8601DateFormatter()
            formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            if let date = formatter.date(from: value) { return date }
            formatter.formatOptions = [.withInternetDateTime]
            guard let date = formatter.date(from: value) else {
                throw DecodingError.dataCorruptedError(in: container, debugDescription: "Invalid ISO-8601 date")
            }
            return date
        }
        encoder.keyEncodingStrategy = .convertToSnakeCase
        encoder.dateEncodingStrategy = .iso8601
    }

    func airports(query: String) async throws -> [Airport] {
        guard query.trimmingCharacters(in: .whitespacesAndNewlines).count >= 2 else { return [] }
        let data = try await apiData(path: "api/airports", method: "GET", query: [URLQueryItem(name: "q", value: query)])
        return try decoder.decode(AirportResponse.self, from: data).airports
    }

    func search(search: FareSearch, startAt: Int, limit: Int) async throws -> SearchChunk {
        var request = URLRequest(url: try endpoint(path: "api/offers"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        try await addAuthHeader(to: &request)
        request.httpBody = try JSONEncoder().encode(SearchRequest(search: search, startAt: startAt, limit: limit))
        let data = try await perform(request)
        return try decoder.decode(SearchChunk.self, from: data)
    }

    func usageAllowance() async throws -> SearchAllowance {
        let data = try await apiData(path: "api/offers", method: "GET")
        return try decoder.decode(SearchAllowance.self, from: data)
    }

    func providerKeyStatus() async throws -> ProviderKeyStatus {
        let data = try await apiData(path: "api/provider-key", method: "GET")
        return try decoder.decode(ProviderKeyStatus.self, from: data)
    }

    func saveProviderKey(_ key: String) async throws -> ProviderKeyStatus {
        let payload = try JSONSerialization.data(withJSONObject: ["apiKey": key])
        let data = try await apiData(path: "api/provider-key", method: "POST", body: payload)
        return try decoder.decode(ProviderKeyStatus.self, from: data)
    }

    func removeProviderKey() async throws {
        _ = try await apiData(path: "api/provider-key", method: "DELETE")
    }

    func loadSavedSearches() async throws -> [SavedSearchItem] {
        let data = try await supabaseData(table: "ios_saved_searches", method: "GET", query: [
            URLQueryItem(name: "select", value: "id,created_at,search_data"),
            URLQueryItem(name: "order", value: "created_at.desc"),
        ])
        return try decoder.decode([SavedSearchRow].self, from: data).map {
            SavedSearchItem(id: $0.id, createdAt: $0.createdAt, search: $0.searchData)
        }
    }

    func saveSearch(_ item: SavedSearchItem) async throws {
        guard let userID = auth.userID else { throw FareGlowError.response("Sign in to save searches to your iPhone account.") }
        let payload = SavedSearchPayload(userId: userID, id: item.id, createdAt: ISO8601DateFormatter().string(from: item.createdAt), searchData: item.search)
        _ = try await supabaseData(table: "ios_saved_searches", method: "POST", query: [URLQueryItem(name: "on_conflict", value: "user_id,id")], body: try encoder.encode(payload))
    }

    func deleteSavedSearch(id: String) async throws {
        guard let userID = auth.userID else { throw FareGlowError.response("Sign in to manage saved searches.") }
        _ = try await supabaseData(table: "ios_saved_searches", method: "DELETE", query: [
            URLQueryItem(name: "user_id", value: "eq.\(userID)"),
            URLQueryItem(name: "id", value: "eq.\(id)"),
        ])
    }

    func loadAccountHistory() async throws -> [SearchHistoryItem] {
        let data = try await supabaseData(table: "ios_search_history", method: "GET", query: [
            URLQueryItem(name: "select", value: "id,searched_at,search_data,offers,checked_pairs,total_pairs"),
            URLQueryItem(name: "order", value: "searched_at.desc"),
            URLQueryItem(name: "limit", value: "30"),
        ])
        return try decoder.decode([HistoryRow].self, from: data).map {
            SearchHistoryItem(id: $0.id, searchedAt: $0.searchedAt, search: $0.searchData, offers: $0.offers, checked: $0.checkedPairs, total: $0.totalPairs)
        }
    }

    func upsertAccountHistory(_ item: SearchHistoryItem) async throws {
        guard let userID = auth.userID else { throw FareGlowError.response("Sign in to sync search history.") }
        let payload = HistoryPayload(
            userId: userID, id: item.id, searchedAt: ISO8601DateFormatter().string(from: item.searchedAt),
            searchData: item.search, offers: item.offers, checkedPairs: item.checked, totalPairs: item.total
        )
        _ = try await supabaseData(table: "ios_search_history", method: "POST", query: [URLQueryItem(name: "on_conflict", value: "user_id,id")], body: try encoder.encode(payload))
    }

    func clearAccountHistory() async throws {
        guard let userID = auth.userID else { throw FareGlowError.response("Sign in to clear account history.") }
        _ = try await supabaseData(table: "ios_search_history", method: "DELETE", query: [URLQueryItem(name: "user_id", value: "eq.\(userID)")])
    }

    private func apiData(path: String, method: String, query: [URLQueryItem] = [], body: Data? = nil) async throws -> Data {
        var request = URLRequest(url: try endpoint(path: path, query: query))
        request.httpMethod = method
        if body != nil { request.setValue("application/json", forHTTPHeaderField: "Content-Type") }
        request.httpBody = body
        try await addAuthHeader(to: &request)
        return try await perform(request)
    }

    private func supabaseData(table: String, method: String, query: [URLQueryItem], body: Data? = nil) async throws -> Data {
        guard configuration.isSupabaseReady, let baseURL = configuration.supabaseURL,
              let anonKey = configuration.supabaseAnonKey,
              let token = try await auth.accessToken() else {
            throw FareGlowError.configuration("Sign in and configure Supabase to sync iPhone searches.")
        }
        var components = URLComponents(url: baseURL.appending(path: "rest/v1/\(table)"), resolvingAgainstBaseURL: false)!
        components.queryItems = query.isEmpty ? nil : query
        var request = URLRequest(url: components.url!)
        request.httpMethod = method
        request.setValue(anonKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if body != nil {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.setValue("resolution=merge-duplicates,return=minimal", forHTTPHeaderField: "Prefer")
        }
        request.httpBody = body
        return try await perform(request)
    }

    private func endpoint(path: String, query: [URLQueryItem] = []) throws -> URL {
        guard configuration.isAPIReady, let baseURL = configuration.apiBaseURL else {
            throw FareGlowError.configuration("Set FARE_GLOW_API_BASE_URL in the iOS app Info.plist to your deployed Fare Glow URL.")
        }
        var components = URLComponents(url: baseURL.appending(path: path), resolvingAgainstBaseURL: false)!
        if !query.isEmpty { components.queryItems = query }
        guard let url = components.url else { throw FareGlowError.configuration("The Fare Glow server URL is not valid.") }
        return url
    }

    private func addAuthHeader(to request: inout URLRequest) async throws {
        if let token = try await auth.accessToken() { request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
    }

    private func perform(_ request: URLRequest) async throws -> Data {
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw FareGlowError.response("Fare Glow returned an invalid response.") }
        guard (200..<300).contains(http.statusCode) else {
            let message = (try? decoder.decode(APIError.self, from: data).error) ?? "Fare Glow could not complete that request."
            throw FareGlowError.response(message)
        }
        return data
    }
}

private struct AirportResponse: Decodable { var airports: [Airport] }
private struct APIError: Decodable { var error: String? }

private struct SearchRequest: Encodable {
    var origin: String
    var destination: String
    var currency: String
    var dateFrom: String
    var dateTo: String
    var minNights: Int
    var maxNights: Int
    var travellers: Int
    var pairsPerRequest: Int
    var advanced: AdvancedFilters
    var startAt: Int
    var limit: Int

    init(search: FareSearch, startAt: Int, limit: Int) {
        origin = search.origin
        destination = search.destination
        currency = search.currency
        dateFrom = search.dateFrom
        dateTo = search.dateTo
        minNights = search.minNights
        maxNights = search.maxNights
        travellers = search.travellers
        pairsPerRequest = search.pairsPerRequest
        advanced = search.advanced
        self.startAt = startAt
        self.limit = limit
    }
}

private struct SavedSearchRow: Decodable {
    var id: String
    var createdAt: Date
    var searchData: FareSearch
}

private struct HistoryRow: Decodable {
    var id: String
    var searchedAt: Date
    var searchData: FareSearch
    var offers: [FlightOffer]
    var checkedPairs: Int
    var totalPairs: Int
}

private struct SavedSearchPayload: Encodable {
    var userId: String
    var id: String
    var createdAt: String
    var searchData: FareSearch
}

private struct HistoryPayload: Encodable {
    var userId: String
    var id: String
    var searchedAt: String
    var searchData: FareSearch
    var offers: [FlightOffer]
    var checkedPairs: Int
    var totalPairs: Int
}
