import Foundation

struct AppConfiguration {
    let apiBaseURL: URL?
    let supabaseURL: URL?
    let supabaseAnonKey: String?
    let authCallbackURL = URL(string: "fareglow://auth-callback")!

    static let current = AppConfiguration(
        apiBaseURL: URL(string: Bundle.main.object(forInfoDictionaryKey: "FARE_GLOW_API_BASE_URL") as? String ?? ""),
        supabaseURL: URL(string: Bundle.main.object(forInfoDictionaryKey: "SUPABASE_URL") as? String ?? ""),
        supabaseAnonKey: Bundle.main.object(forInfoDictionaryKey: "SUPABASE_ANON_KEY") as? String
    )

    var isSupabaseReady: Bool {
        guard let supabaseURL, let supabaseAnonKey else { return false }
        return supabaseURL.scheme == "https" && !supabaseAnonKey.isEmpty && !supabaseAnonKey.contains("your-")
    }

    var isAPIReady: Bool {
        guard let apiBaseURL else { return false }
        return apiBaseURL.scheme == "https" && !apiBaseURL.host.orEmpty.isEmpty && !apiBaseURL.host.orEmpty.contains("example")
    }
}

private extension Optional where Wrapped == String {
    var orEmpty: String { self ?? "" }
}
