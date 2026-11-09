import SwiftUI

struct SearchView: View {
    @ObservedObject var auth: SupabaseService
    @ObservedObject var account: AccountStore
    @ObservedObject var history: HistoryStore
    @ObservedObject var search: SearchStore
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var advancedOpen = false
    @State private var showAccount = false

    private var candidateCount: Int { search.search.candidatePairCount }
    private var maxPairs: Int { account.maximumPairCount(candidateCount: candidateCount) }
    private var pairBinding: Binding<Int> {
        Binding(
            get: { min(search.search.pairsPerRequest, max(1, maxPairs)) },
            set: { search.search.pairsPerRequest = $0 }
        )
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    hero
                    searchCard
                    if search.isLoading, let progress = search.progress {
                        VStack(alignment: .leading, spacing: 8) {
                            ProgressView(value: Double(progress.checked), total: Double(max(progress.target, 1)))
                            Text("Checking \(progress.checked) of \(progress.target) selected pairs")
                                .font(.footnote).foregroundStyle(SunriseTheme.muted)
                        }.sunriseCard()
                    }
                    if !search.errorMessage.isEmpty {
                        Label(search.errorMessage, systemImage: "info.circle.fill")
                            .font(.footnote).foregroundStyle(SunriseTheme.ink)
                            .frame(maxWidth: .infinity, alignment: .leading).sunriseCard()
                    }
                    ResultsView(search: search, history: history, isSignedIn: auth.isSignedIn) {
                        showAccount = true
                    }
                    .animation(reduceMotion ? nil : .easeInOut(duration: 0.18), value: search.offers.count)
                }
                .padding(.horizontal, 16).padding(.top, 10).padding(.bottom, 28)
            }
            .scrollDismissesKeyboard(.interactively)
            .background(
                LinearGradient(colors: [SunriseTheme.paper, Color(hex: 0xF7F1E8)], startPoint: .topLeading, endPoint: .bottomTrailing)
                    .ignoresSafeArea()
            )
            .navigationTitle("Fare Glow")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button { showAccount = true } label: { Image(systemName: "person.crop.circle").font(.title3) }
                        .accessibilityLabel("Account settings")
                }
            }
            .sheet(isPresented: $showAccount) { AccountView(auth: auth, account: account).presentationDetents([.large]) }
            .onChange(of: search.search.dateFrom) { _, _ in search.clampPairCount() }
            .onChange(of: search.search.dateTo) { _, _ in search.clampPairCount() }
            .onChange(of: search.search.minNights) { _, _ in search.clampPairCount() }
            .onChange(of: search.search.maxNights) { _, _ in search.clampPairCount() }
            .onChange(of: account.keyConfigured) { _, _ in search.clampPairCount() }
            .onChange(of: account.allowance?.requestsRemaining) { _, _ in search.clampPairCount() }
            .task { await account.refresh() }
        }
    }

    private var hero: some View {
        VStack(alignment: .leading, spacing: 12) {
            Label("FIND YOUR LOW FARE WINDOW", systemImage: "sun.max.fill")
                .font(.caption.weight(.bold)).tracking(1.1).foregroundStyle(SunriseTheme.coralDark)
            Text("Good trips start\nwith better dates.")
                .font(.system(size: 32, weight: .bold, design: .rounded)).tracking(-1.2).foregroundStyle(SunriseTheme.ink)
            Text("Choose when you can travel. We’ll help you spot the return dates that cost less.")
                .font(.subheadline).foregroundStyle(SunriseTheme.muted)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(20)
        .background(LinearGradient(colors: [Color(hex: 0xFFFAF3), Color(hex: 0xF7E7DB), Color(hex: 0xF4DFBD)], startPoint: .topLeading, endPoint: .bottomTrailing), in: RoundedRectangle(cornerRadius: 22, style: .continuous))
        .overlay(alignment: .bottomTrailing) {
            Image(systemName: "sun.max.fill").font(.system(size: 60)).foregroundStyle(SunriseTheme.gold.opacity(0.35)).padding(18).accessibilityHidden(true)
        }
    }

    private var searchCard: some View {
        VStack(alignment: .leading, spacing: 15) {
            HStack {
                VStack(alignment: .leading, spacing: 3) {
                    Text("YOUR TRIP").font(.caption2.weight(.bold)).tracking(1.2).foregroundStyle(SunriseTheme.muted)
                    Text("Where can you go?").font(.title3.weight(.bold)).foregroundStyle(SunriseTheme.ink)
                }
                Spacer()
                Label("Return", systemImage: "arrow.left.arrow.right").font(.caption.weight(.semibold)).foregroundStyle(Color(hex: 0x586D5B))
                    .padding(.horizontal, 11).padding(.vertical, 8).background(SunriseTheme.sage.opacity(0.55), in: Capsule())
            }

            AirportField(title: "FROM", text: $search.search.origin)
            HStack {
                Spacer()
                Button {
                    let origin = search.search.origin
                    search.search.origin = search.search.destination
                    search.search.destination = origin
                } label: { Label("Swap route", systemImage: "arrow.up.arrow.down").labelStyle(.iconOnly).font(.subheadline.weight(.semibold)) }
                    .accessibilityLabel("Swap origin and destination")
                Spacer()
            }
            AirportField(title: "TO", text: $search.search.destination)

            VStack(alignment: .leading, spacing: 7) {
                sectionLabel("TRAVEL DATE WINDOW")
                HStack(spacing: 12) {
                    DatePicker("Earliest", selection: dateBinding(for: true), in: Calendar.current.startOfDay(for: Date())..., displayedComponents: .date)
                    DatePicker("Latest", selection: dateBinding(for: false), in: fromDate...latestAllowedDate, displayedComponents: .date)
                }
                .datePickerStyle(.compact).labelsHidden()
                .padding(11).background(Color(hex: 0xFFFAF5), in: RoundedRectangle(cornerRadius: 12))
            }

            HStack(spacing: 10) {
                VStack(alignment: .leading, spacing: 7) {
                    sectionLabel("TRIP LENGTH · DAYS INCLUDING DEPARTURE")
                    HStack {
                        dayMenu(title: "Min", value: Binding(get: { search.search.minNights }, set: { value in
                            search.search.minNights = value
                            search.search.maxNights = max(search.search.maxNights, value)
                        }), minimum: 1, maximum: 240)
                        Text("to").font(.caption).foregroundStyle(SunriseTheme.muted)
                        dayMenu(title: "Max", value: $search.search.maxNights, minimum: search.search.minNights, maximum: 240)
                    }
                }
                VStack(alignment: .leading, spacing: 7) {
                    sectionLabel("TRAVELERS")
                    Picker("Travelers", selection: $search.search.travellers) {
                        ForEach(1...9, id: \.self) { count in Text("\(count) \(count == 1 ? "adult" : "adults")").tag(count) }
                    }.pickerStyle(.menu).frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal, 11).padding(.vertical, 10).background(Color(hex: 0xFFFAF5), in: RoundedRectangle(cornerRadius: 11))
                }.frame(width: 115)
            }

            VStack(alignment: .leading, spacing: 7) {
                sectionLabel("FARE CURRENCY")
                Picker("Fare currency", selection: $search.search.currency) {
                    ForEach(FareSearch.currencies, id: \.self) { Text($0).tag($0) }
                }.pickerStyle(.menu).frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, 11).padding(.vertical, 10).background(Color(hex: 0xFFFAF5), in: RoundedRectangle(cornerRadius: 11))
            }

            VStack(alignment: .leading, spacing: 4) {
                sectionLabel("DATE PAIRS PER REQUEST")
                Stepper(value: pairBinding, in: 1...max(1, maxPairs)) {
                    Text("\(pairBinding.wrappedValue) \(pairBinding.wrappedValue == 1 ? "date pair" : "date pairs")")
                        .font(.subheadline.weight(.semibold)).foregroundStyle(SunriseTheme.ink)
                }
                .disabled(search.isLoading || maxPairs == 0)
                .accessibilityLabel("Date pairs per request")
                Text(pairHelpText)
                    .font(.caption2).foregroundStyle(SunriseTheme.muted)
            }
            .padding(12).background(Color(hex: 0xF7F1E8), in: RoundedRectangle(cornerRadius: 12))

            DisclosureGroup(isExpanded: $advancedOpen) {
                AdvancedFiltersView(filters: $search.search.advanced)
                    .padding(.top, 10)
            } label: {
                Label("Advanced flight options", systemImage: "slider.horizontal.3").font(.subheadline.weight(.semibold)).foregroundStyle(SunriseTheme.ink)
            }

            Button {
                Task { await search.runSearch() }
            } label: {
                HStack {
                    if search.isLoading { ProgressView().tint(.white) }
                    Text(search.isLoading ? "Searching dates…" : "Find cheaper dates")
                    Spacer()
                    Image(systemName: "arrow.right")
                }
                .font(.headline).foregroundStyle(.white).padding(.horizontal, 16).frame(height: 50)
                .background(SunriseTheme.coral, in: RoundedRectangle(cornerRadius: 13, style: .continuous))
            }
            .disabled(search.isLoading || candidateCount == 0)
            .accessibilityHint("Checks up to the selected number of return date pairs.")
        }
        .sunriseCard()
    }

    private var pairHelpText: String {
        if maxPairs == 0 && candidateCount > 0 { return "No personal SerpApi searches remain this month." }
        if auth.isSignedIn && account.keyConfigured {
            return "Using your saved SerpApi key. The count is capped by your remaining allowance and valid dates."
        }
        return "Using Fare Glow’s shared key. Sign in and add your own SerpApi key to request more than 8 pairs."
    }

    private var fromDate: Date { FareSearch.date(search.search.dateFrom) ?? Calendar.current.startOfDay(for: Date()) }
    private var latestAllowedDate: Date { Calendar.current.date(byAdding: .day, value: 366, to: fromDate) ?? fromDate }

    private func dateBinding(for start: Bool) -> Binding<Date> {
        Binding(
            get: { FareSearch.date(start ? search.search.dateFrom : search.search.dateTo) ?? Date() },
            set: { value in
                if start {
                    search.search.dateFrom = FareSearch.isoDate(value)
                    if search.search.dateTo < search.search.dateFrom { search.search.dateTo = search.search.dateFrom }
                    let latest = Calendar.current.date(byAdding: .day, value: 366, to: value) ?? value
                    if let currentLatest = FareSearch.date(search.search.dateTo), currentLatest > latest {
                        search.search.dateTo = FareSearch.isoDate(latest)
                    }
                } else { search.search.dateTo = FareSearch.isoDate(value) }
            }
        )
    }

    private func dayMenu(title: String, value: Binding<Int>, minimum: Int, maximum: Int) -> some View {
        Menu {
            ForEach(minimum...maximum, id: \.self) { day in
                Button("\(day) day\(day == 1 ? "" : "s")") { value.wrappedValue = day }
            }
        } label: {
            HStack(spacing: 6) { Text("\(value.wrappedValue) days").font(.subheadline.weight(.semibold)); Image(systemName: "chevron.down").font(.caption2) }
                .foregroundStyle(SunriseTheme.ink).padding(.horizontal, 10).padding(.vertical, 10).background(Color(hex: 0xFFFAF5), in: RoundedRectangle(cornerRadius: 10))
        }
        .accessibilityLabel("\(title) trip length")
    }

    private func sectionLabel(_ title: String) -> some View {
        Text(title).font(.caption2.weight(.bold)).tracking(0.8).foregroundStyle(SunriseTheme.muted)
    }

}
