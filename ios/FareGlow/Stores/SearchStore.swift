import Combine
import Foundation

@MainActor
final class SearchStore: ObservableObject {
    private let api: FareGlowAPI
    private let account: AccountStore
    private let history: HistoryStore

    @Published var search = FareSearch()
    @Published private(set) var offers: [FlightOffer] = []
    @Published private(set) var isLoading = false
    @Published private(set) var errorMessage = ""
    @Published private(set) var checkedPairs = 0
    @Published private(set) var totalPairs = 0
    @Published private(set) var nextOffset = 0
    @Published private(set) var hasMoreDates = false
    @Published private(set) var progress: (checked: Int, target: Int)?
    @Published private(set) var activeSearch: FareSearch?
    @Published private(set) var keySource = ""
    private var activeHistoryID = ""

    init(api: FareGlowAPI, account: AccountStore, history: HistoryStore) {
        self.api = api
        self.account = account
        self.history = history
    }

    func clampPairCount() {
        let maximum = account.maximumPairCount(candidateCount: search.candidatePairCount)
        if maximum > 0, search.pairsPerRequest > maximum { search.pairsPerRequest = maximum }
    }

    func runSearch() async {
        errorMessage = ""
        guard let from = FareSearch.date(search.dateFrom), let to = FareSearch.date(search.dateTo), to >= from else {
            errorMessage = "Choose a valid travel date window."
            return
        }
        guard !search.origin.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
              !search.destination.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            errorMessage = "Add an origin and destination airport."
            return
        }
        guard search.origin.lowercased() != search.destination.lowercased() else {
            errorMessage = "Choose two different airports."
            return
        }
        let candidateCount = search.candidatePairCount
        guard candidateCount > 0 else { errorMessage = "Your travel window has no valid date pairs for this trip length."; return }
        clampPairCount()
        var requestSearch = search
        requestSearch.pairsPerRequest = min(requestSearch.pairsPerRequest, max(candidateCount, 1))
        activeSearch = requestSearch
        activeHistoryID = UUID().uuidString
        offers = []
        checkedPairs = 0
        totalPairs = candidateCount
        nextOffset = 0
        hasMoreDates = false
        await requestMore(startAt: 0, using: requestSearch, reset: true)
    }

    func checkMoreDates() async {
        guard let activeSearch, hasMoreDates, !isLoading else { return }
        await requestMore(startAt: nextOffset, using: activeSearch, reset: false)
    }

    func restore(_ item: SavedSearchItem) {
        search = item.search
        activeSearch = nil
        activeHistoryID = ""
        offers = []
        checkedPairs = 0
        totalPairs = search.candidatePairCount
        nextOffset = 0
        hasMoreDates = false
        errorMessage = "Search restored. Run it again to check current fares."
    }

    func restore(_ item: SearchHistoryItem) {
        search = item.search
        activeSearch = item.search
        offers = item.offers
        checkedPairs = item.checked
        totalPairs = item.total
        nextOffset = item.checked
        activeHistoryID = item.id
        hasMoreDates = false
        errorMessage = ""
    }

    private func requestMore(startAt: Int, using requestSearch: FareSearch, reset: Bool) async {
        let target = min(requestSearch.pairsPerRequest, max(0, requestSearch.candidatePairCount - startAt))
        guard target > 0 else { errorMessage = "No date pairs remain in this search window."; return }
        isLoading = true
        progress = (0, target)
        errorMessage = ""
        var requestChecked = 0
        var cursor = startAt
        defer { isLoading = false; progress = nil }

        while requestChecked < target {
            let limit = min(8, target - requestChecked)
            do {
                let chunk = try await api.search(search: requestSearch, startAt: cursor, limit: limit)
                offers = sorted(offers + chunk.offers, by: requestSearch.advanced.sortBy)
                checkedPairs += chunk.checked
                requestChecked += chunk.checked
                cursor = chunk.nextOffset
                nextOffset = cursor
                totalPairs = chunk.totalCandidates
                hasMoreDates = chunk.moreAvailable
                keySource = chunk.keySource ?? keySource
                progress = (requestChecked, target)
                await history.record(search: requestSearch, offers: offers, checked: checkedPairs, total: totalPairs, id: activeHistoryID)

                if chunk.budgetReached {
                    errorMessage = "This month’s SerpApi search allowance has been reached. Fares already found are still shown."
                    hasMoreDates = false
                    break
                }
                if chunk.checked == 0 || (!chunk.moreAvailable && requestChecked < target) { break }
            } catch {
                errorMessage = error.localizedDescription
                break
            }
        }

        if reset, offers.isEmpty, errorMessage.isEmpty {
            errorMessage = "No fares came back for the dates checked. Try another window or trip length."
        }
    }

    private func sorted(_ offers: [FlightOffer], by sortBy: Int) -> [FlightOffer] {
        switch sortBy {
        case 3: return offers.sorted { $0.outboundTime < $1.outboundTime }
        case 5: return offers.sorted { ($0.durationMinutes ?? Int.max) < ($1.durationMinutes ?? Int.max) }
        case 6: return offers.sorted { ($0.emissionsGrams ?? Double.greatestFiniteMagnitude) < ($1.emissionsGrams ?? Double.greatestFiniteMagnitude) }
        default: return offers.sorted { $0.price < $1.price }
        }
    }
}
