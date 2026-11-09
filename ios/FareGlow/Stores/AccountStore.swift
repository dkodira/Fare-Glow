import Combine
import Foundation

@MainActor
final class AccountStore: ObservableObject {
    let auth: SupabaseService
    private let api: FareGlowAPI
    @Published private(set) var keyConfigured = false
    @Published private(set) var keyUsage: Int?
    @Published private(set) var allowance: SearchAllowance?
    @Published var isBusy = false
    @Published var message = ""

    init(auth: SupabaseService, api: FareGlowAPI) {
        self.auth = auth
        self.api = api
    }

    func maximumPairCount(candidateCount: Int) -> Int {
        let candidates = min(max(candidateCount, 0), 250)
        guard auth.isSignedIn, keyConfigured else { return min(8, candidates) }
        return min(candidates, max(0, allowance?.requestsRemaining ?? keyUsage ?? 8))
    }

    func refresh() async {
        guard auth.isSignedIn else {
            keyConfigured = false
            keyUsage = nil
            allowance = try? await api.usageAllowance()
            return
        }
        do {
            let status = try await api.providerKeyStatus()
            keyConfigured = status.configured
            keyUsage = status.usageRemaining
        } catch {
            message = error.localizedDescription
        }
        allowance = try? await api.usageAllowance()
        if let allowance, allowance.keySource == "your SerpApi key" {
            keyUsage = allowance.requestsRemaining
        }
    }

    func sendEmailLink(_ email: String) async {
        isBusy = true
        message = ""
        do { try await auth.sendEmailLink(email.trimmingCharacters(in: .whitespacesAndNewlines)) }
        catch { message = error.localizedDescription }
        isBusy = false
    }

    func googleSignIn() async -> URL? {
        do { return try await auth.googleSignInURL() }
        catch { message = error.localizedDescription; return nil }
    }

    func signOut() async {
        do { try await auth.signOut(); keyConfigured = false; keyUsage = nil; message = "You’ve signed out." }
        catch { message = error.localizedDescription }
    }

    @discardableResult
    func saveKey(_ key: String) async -> Bool {
        isBusy = true
        message = ""
        do {
            let status = try await api.saveProviderKey(key)
            keyConfigured = status.configured
            keyUsage = status.usageRemaining
            allowance = try? await api.usageAllowance()
            if let allowance { keyUsage = allowance.requestsRemaining }
            message = "Key saved securely. Fare Glow will use it for your searches."
            isBusy = false
            return true
        } catch { message = error.localizedDescription }
        isBusy = false
        return false
    }

    func removeKey() async {
        isBusy = true
        message = ""
        do {
            try await api.removeProviderKey()
            keyConfigured = false
            keyUsage = nil
            allowance = try? await api.usageAllowance()
            message = "Your saved SerpApi key was removed. Fare Glow’s shared key will be used when available."
        } catch { message = error.localizedDescription }
        isBusy = false
    }
}
