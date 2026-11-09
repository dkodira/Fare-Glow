import SwiftUI

@main
@MainActor
struct FareGlowApp: App {
    @StateObject private var auth: SupabaseService
    @StateObject private var account: AccountStore
    @StateObject private var history: HistoryStore
    @StateObject private var search: SearchStore

    init() {
        let auth = SupabaseService.shared
        let api = FareGlowAPI(configuration: .current, auth: auth)
        let account = AccountStore(auth: auth, api: api)
        let history = HistoryStore(auth: auth, api: api)
        let search = SearchStore(api: api, account: account, history: history)
        _auth = StateObject(wrappedValue: auth)
        _account = StateObject(wrappedValue: account)
        _history = StateObject(wrappedValue: history)
        _search = StateObject(wrappedValue: search)
    }

    var body: some Scene {
        WindowGroup {
            MainTabView(auth: auth, account: account, history: history, search: search)
                .preferredColorScheme(.light)
                .tint(SunriseTheme.coralDark)
                .onOpenURL { url in Task { await auth.handle(url: url) } }
                .onChange(of: auth.userID) { _, _ in
                    Task { await account.refresh(); await history.reload(); search.clampPairCount() }
                }
                .task {
                    await auth.restoreSession()
                    await account.refresh()
                    await history.reload()
                }
        }
    }
}

struct MainTabView: View {
    @ObservedObject var auth: SupabaseService
    @ObservedObject var account: AccountStore
    @ObservedObject var history: HistoryStore
    @ObservedObject var search: SearchStore
    @State private var selectedTab = 0

    var body: some View {
        TabView(selection: $selectedTab) {
            SearchView(auth: auth, account: account, history: history, search: search)
                .tabItem { Label("Search", systemImage: "magnifyingglass") }.tag(0)
            SavedSearchesView(auth: auth, history: history, search: search) { selectedTab = 0 }
                .tabItem { Label("Saved", systemImage: "bookmark") }.tag(1)
            SearchHistoryView(auth: auth, history: history, search: search) { selectedTab = 0 }
                .tabItem { Label("History", systemImage: "clock.arrow.circlepath") }.tag(2)
            AccountView(auth: auth, account: account)
                .tabItem { Label("Account", systemImage: "person.crop.circle") }.tag(3)
        }
    }
}
