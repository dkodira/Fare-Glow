import Foundation
import Combine
import Supabase

@MainActor
final class SupabaseService: ObservableObject {
    static let shared = SupabaseService(configuration: .current)

    let configuration: AppConfiguration
    let client: SupabaseClient?
    @Published private(set) var userID: String?
    @Published private(set) var email: String?
    @Published private(set) var authMessage = ""

    init(configuration: AppConfiguration) {
        self.configuration = configuration
        if configuration.isSupabaseReady, let url = configuration.supabaseURL, let key = configuration.supabaseAnonKey {
            client = SupabaseClient(supabaseURL: url, supabaseKey: key)
        } else {
            client = nil
        }
    }

    var isSignedIn: Bool { userID != nil }

    func restoreSession() async {
        guard let client else { return }
        do { publish(try await client.auth.session) }
        catch { userID = nil; email = nil }
    }

    func sendEmailLink(_ address: String) async throws {
        guard let client else { throw FareGlowError.configuration("Add the Supabase URL and public anon key in the app Info.plist settings.") }
        try await client.auth.signInWithOTP(email: address, redirectTo: configuration.authCallbackURL)
        authMessage = "Check your inbox for a secure sign-in link."
    }

    func googleSignInURL() async throws -> URL {
        guard let client else { throw FareGlowError.configuration("Add the Supabase URL and public anon key in the app Info.plist settings.") }
        return try await client.auth.getOAuthSignInURL(provider: .google, redirectTo: configuration.authCallbackURL)
    }

    func handle(url: URL) async {
        guard let client else { return }
        do {
            publish(try await client.auth.session(from: url))
            authMessage = "You’re signed in."
        } catch {
            authMessage = "The sign-in link could not be completed. Open a fresh link from your email."
        }
    }

    func accessToken() async throws -> String? {
        guard let client else { return nil }
        return try await client.auth.session.accessToken
    }

    func signOut() async throws {
        guard let client else { return }
        try await client.auth.signOut()
        userID = nil
        email = nil
        authMessage = "You’ve signed out."
    }

    private func publish(_ session: Session) {
        userID = session.user.id.uuidString
        email = session.user.email
        authMessage = ""
    }
}

enum FareGlowError: LocalizedError {
    case configuration(String)
    case response(String)

    var errorDescription: String? {
        switch self {
        case .configuration(let message), .response(let message): return message
        }
    }
}
