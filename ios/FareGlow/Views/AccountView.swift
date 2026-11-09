import SwiftUI

struct AccountView: View {
    @ObservedObject var auth: SupabaseService
    @ObservedObject var account: AccountStore
    @Environment(\.openURL) private var openURL
    @State private var emailAddress = ""
    @State private var apiKey = ""

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    VStack(alignment: .leading, spacing: 8) {
                        Label("YOUR ACCOUNT", systemImage: "person.crop.circle.fill")
                            .font(.caption.weight(.bold)).tracking(1).foregroundStyle(SunriseTheme.coralDark)
                        Text(auth.isSignedIn ? "Account settings" : "Sign in to Fare Glow")
                            .font(.title2.weight(.bold)).foregroundStyle(SunriseTheme.ink)
                        Text("Your personal SerpApi key is encrypted on the server. It is never shown again or stored in the iPhone app.")
                            .font(.subheadline).foregroundStyle(SunriseTheme.muted)
                    }.sunriseCard()

                    if !auth.isSignedIn {
                        VStack(alignment: .leading, spacing: 13) {
                            Text("Sign in with email").font(.headline).foregroundStyle(SunriseTheme.ink)
                            TextField("Email address", text: $emailAddress)
                                .keyboardType(.emailAddress).textInputAutocapitalization(.never).autocorrectionDisabled()
                                .padding(12).background(SunriseTheme.paper, in: RoundedRectangle(cornerRadius: 11))
                                .accessibilityLabel("Email address")
                            Button {
                                Task { await account.sendEmailLink(emailAddress) }
                            } label: {
                                HStack { if account.isBusy { ProgressView().tint(.white) }; Text("Email me a sign-in link") }
                                    .frame(maxWidth: .infinity).padding(13).foregroundStyle(.white).background(SunriseTheme.coral, in: RoundedRectangle(cornerRadius: 11))
                            }.disabled(account.isBusy || emailAddress.isEmpty)

                            Button {
                                Task { if let url = await account.googleSignIn() { openURL(url) } }
                            } label: {
                                Label("Continue with Google", systemImage: "g.circle.fill")
                                    .frame(maxWidth: .infinity).padding(13).foregroundStyle(SunriseTheme.ink)
                                    .background(SunriseTheme.card, in: RoundedRectangle(cornerRadius: 11))
                                    .overlay(RoundedRectangle(cornerRadius: 11).stroke(SunriseTheme.line, lineWidth: 1))
                            }
                        }.sunriseCard()
                    } else {
                        VStack(alignment: .leading, spacing: 13) {
                            HStack {
                                Image(systemName: "checkmark.seal.fill").foregroundStyle(Color(hex: 0x66866A))
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(auth.email ?? "Signed in").font(.subheadline.weight(.semibold)).foregroundStyle(SunriseTheme.ink)
                                    Text("Signed in with Supabase").font(.caption).foregroundStyle(SunriseTheme.muted)
                                }
                                Spacer()
                            }
                            Divider().overlay(SunriseTheme.line)
                            Text("SERPAPI KEY").font(.caption2.weight(.bold)).tracking(0.8).foregroundStyle(SunriseTheme.muted)
                            if account.keyConfigured {
                                Label("Your key is saved", systemImage: "lock.fill").font(.subheadline.weight(.semibold)).foregroundStyle(Color(hex: 0x536957))
                                Text(account.keyUsage.map { "\($0) searches remain in the current monthly allowance." } ?? "Your saved key is hidden.")
                                    .font(.caption).foregroundStyle(SunriseTheme.muted)
                            } else {
                                Text("Without a personal key, Fare Glow uses its shared key when the deployment provides one. Searches stay at 8 pairs per request.")
                                    .font(.caption).foregroundStyle(SunriseTheme.muted)
                            }
                            SecureField(account.keyConfigured ? "Paste a replacement key" : "Paste your SerpApi key", text: $apiKey)
                                .textInputAutocapitalization(.never).autocorrectionDisabled()
                                .padding(12).background(SunriseTheme.paper, in: RoundedRectangle(cornerRadius: 11))
                                .accessibilityLabel(account.keyConfigured ? "Replacement SerpApi key" : "SerpApi key")
                            Button {
                                Task {
                                    if await account.saveKey(apiKey) { apiKey = "" }
                                }
                            } label: {
                                HStack { if account.isBusy { ProgressView().tint(.white) }; Text(account.keyConfigured ? "Replace key" : "Save key") }
                                    .frame(maxWidth: .infinity).padding(13).foregroundStyle(.white).background(SunriseTheme.coral, in: RoundedRectangle(cornerRadius: 11))
                            }.disabled(account.isBusy || apiKey.count < 8)
                            if account.keyConfigured {
                                Button(role: .destructive) { Task { await account.removeKey() } } label: {
                                    Label("Remove saved key", systemImage: "trash")
                                }.disabled(account.isBusy)
                            }
                            Button(role: .destructive) { Task { await account.signOut() } } label: {
                                Label("Sign out", systemImage: "rectangle.portrait.and.arrow.right")
                            }.padding(.top, 4)
                        }.sunriseCard()
                    }

                    if !account.message.isEmpty {
                        Text(account.message).font(.footnote).foregroundStyle(SunriseTheme.ink).frame(maxWidth: .infinity, alignment: .leading).sunriseCard()
                    }
                    if !auth.authMessage.isEmpty {
                        Text(auth.authMessage).font(.footnote).foregroundStyle(SunriseTheme.ink).frame(maxWidth: .infinity, alignment: .leading).sunriseCard()
                    }
                }
                .padding(16)
            }
            .background(SunriseTheme.paper.ignoresSafeArea())
            .navigationTitle("Account")
            .navigationBarTitleDisplayMode(.inline)
            .task { await account.refresh() }
        }
    }
}
