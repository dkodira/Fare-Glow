import Combine
import Foundation

@MainActor
final class HistoryStore: ObservableObject {
    private let auth: SupabaseService
    private let api: FareGlowAPI
    private let deviceKey = "fare-glow-ios-search-history-v1"
    @Published private(set) var savedSearches: [SavedSearchItem] = []
    @Published private(set) var history: [SearchHistoryItem] = []
    @Published var message = ""
    @Published var isLoading = false

    init(auth: SupabaseService, api: FareGlowAPI) {
        self.auth = auth
        self.api = api
    }

    func reload() async {
        isLoading = true
        message = ""
        if auth.isSignedIn {
            do {
                async let saved = api.loadSavedSearches()
                async let accountHistory = api.loadAccountHistory()
                savedSearches = try await saved
                history = try await accountHistory
            } catch { message = error.localizedDescription }
        } else {
            savedSearches = []
            history = readDeviceHistory()
        }
        isLoading = false
    }

    func record(search: FareSearch, offers: [FlightOffer], checked: Int, total: Int, id: String) async {
        let existing = history.first(where: { $0.id == id })
        let item = SearchHistoryItem(id: id, searchedAt: existing?.searchedAt ?? Date(), search: search, offers: offers, checked: checked, total: total)
        if auth.isSignedIn {
            do {
                try await api.upsertAccountHistory(item)
                history = [item] + history.filter { $0.id != item.id }
            } catch { message = error.localizedDescription }
        } else {
            history = [item] + history.filter { $0.id != item.id }
            history = Array(history.prefix(30))
            writeDeviceHistory()
        }
    }

    func save(_ search: FareSearch) async {
        guard auth.isSignedIn else { message = "Sign in to save searches to your account."; return }
        let item = SavedSearchItem(id: UUID().uuidString, createdAt: Date(), search: search)
        do {
            try await api.saveSearch(item)
            savedSearches.insert(item, at: 0)
            message = "Search saved to your iPhone account."
        } catch { message = error.localizedDescription }
    }

    func deleteSaved(_ item: SavedSearchItem) async {
        do {
            try await api.deleteSavedSearch(id: item.id)
            savedSearches.removeAll { $0.id == item.id }
        } catch { message = error.localizedDescription }
    }

    func clearHistory() async {
        if auth.isSignedIn {
            do { try await api.clearAccountHistory(); history = [] }
            catch { message = error.localizedDescription }
        } else {
            history = []
            UserDefaults.standard.removeObject(forKey: deviceKey)
        }
    }

    private func readDeviceHistory() -> [SearchHistoryItem] {
        guard let data = UserDefaults.standard.data(forKey: deviceKey) else { return [] }
        return (try? JSONDecoder().decode([SearchHistoryItem].self, from: data)) ?? []
    }

    private func writeDeviceHistory() {
        guard let data = try? JSONEncoder().encode(history) else { return }
        UserDefaults.standard.set(data, forKey: deviceKey)
    }
}
