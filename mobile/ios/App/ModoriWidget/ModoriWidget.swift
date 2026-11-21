import AppIntents
import SwiftUI
import WidgetKit

/// iPhone 홈 화면 위젯: 오늘 남은 할 일을 본다(2026-11-21 운영자 요청, 읽기 전용. Android는 ModoriWidgetProvider.java, docs/decisions.md).
/// 위젯을 누르면 앱이 열리고, 오른쪽 위 단추를 누르면 바로 새로 받는다. 30분마다 새로 받고(시스템이 더 늦출 수 있다),
/// 앱 화면을 떠날 때도 새로 받는다(MainViewController.syncWidget).
@main
struct ModoriWidgetBundle: WidgetBundle {
    var body: some Widget {
        TodosWidget()
    }
}

struct TodosWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "ModoriTodos", provider: TodosProvider()) { entry in
            TodosView(entry: entry)
        }
        .configurationDisplayName(WidgetText.current.name)
        .description(WidgetText.current.description)
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}

struct TodosEntry: TimelineEntry {
    let date: Date
    let state: TodosState
}

struct TodosProvider: TimelineProvider {
    // Android 위젯과 같은 간격. 시스템이 하루 새로 고침 횟수를 정하므로 더 늦어질 수 있다.
    private static let refreshInterval: TimeInterval = 30 * 60

    func placeholder(in context: Context) -> TodosEntry {
        TodosEntry(date: Date(), state: .ok(WidgetText.current.sample, stale: false))
    }

    func getSnapshot(in context: Context, completion: @escaping (TodosEntry) -> Void) {
        // 위젯을 고르는 화면에서는 예시를 보여 준다. 로그인 전에도 모양을 볼 수 있다.
        if context.isPreview {
            completion(placeholder(in: context))
            return
        }
        Task {
            completion(TodosEntry(date: Date(), state: await TodosLoader.load()))
        }
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<TodosEntry>) -> Void) {
        Task {
            let now = Date()
            let entry = TodosEntry(date: now, state: await TodosLoader.load())
            completion(Timeline(entries: [entry], policy: .after(now.addingTimeInterval(TodosProvider.refreshInterval))))
        }
    }
}

struct TodosView: View {
    @Environment(\.widgetFamily) private var family
    @Environment(\.colorScheme) private var colorScheme
    let entry: TodosEntry
    private let text = WidgetText.current

    var body: some View {
        let palette = WidgetPalette(dark: colorScheme == .dark)
        VStack(alignment: .leading, spacing: 5) {
            header(palette)
            content(palette)
            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .foregroundStyle(palette.text)
        .containerBackground(palette.background, for: .widget)
    }

    private func header(_ palette: WidgetPalette) -> some View {
        HStack(spacing: 4) {
            Text(title)
                .font(.system(size: 14, weight: .bold))
                .lineLimit(1)
                .minimumScaleFactor(0.75)
            Spacer(minLength: 0)
            Button(intent: RefreshTodosIntent()) {
                Image(systemName: "arrow.clockwise")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(palette.muted)
                    .frame(width: 22, height: 22)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel(text.refresh)
        }
    }

    @ViewBuilder
    private func content(_ palette: WidgetPalette) -> some View {
        switch entry.state {
        case .needLogin:
            message(text.needLogin, palette)
        case .error:
            message(text.error, palette)
        case .ok(let todos, _):
            let shown = Array(todos.todos.prefix(maxRows))
            ForEach(shown) { todo in
                row(todo, palette)
            }
            // 서버가 알려 준 남은 개수에서 보여 준 줄을 뺀 만큼이 "외 N개"다(서버는 20줄까지만 내려 주지만 개수는 전체다).
            let more = todos.remaining - shown.count
            if more > 0 {
                Text(text.more(more))
                    .font(.system(size: 12))
                    .foregroundStyle(palette.muted)
            }
        }
    }

    private func row(_ todo: WidgetTodo, _ palette: WidgetPalette) -> some View {
        HStack(spacing: 6) {
            Circle()
                .fill(WidgetPalette.color(hex: todo.color) ?? WidgetPalette.fallbackDot)
                .frame(width: 7, height: 7)
            Text(todo.content)
                .font(.system(size: 13))
                .lineLimit(1)
            if let total = todo.subTotal {
                Text(verbatim: "\(todo.subDone ?? 0)/\(total)")
                    .font(.system(size: 12))
                    .foregroundStyle(palette.muted)
                    .layoutPriority(1)
            }
        }
    }

    private func message(_ value: String, _ palette: WidgetPalette) -> some View {
        Text(value)
            .font(.system(size: 13))
            .foregroundStyle(palette.muted)
            .fixedSize(horizontal: false, vertical: true)
    }

    private var title: String {
        guard case .ok(let todos, let stale) = entry.state else { return text.appName }
        let base = todos.remaining == 0 ? text.none : text.title(todos.remaining)
        return stale ? "\(base) · \(text.stale)" : base
    }

    /// 위젯 크기마다 들어가는 줄 수. 가장 작은 iPhone(SE)의 위젯 높이에 맞췄다.
    private var maxRows: Int {
        family == .systemLarge ? 10 : 3
    }
}

/// 위젯의 새로 고침 단추. 하는 일은 없다. 단추를 누르고 나면 시스템이 위젯을 다시 그려(getTimeline) 새로 받는다.
struct RefreshTodosIntent: AppIntent {
    static let title: LocalizedStringResource = "Refresh"
    // 단축어 앱의 동작 목록에는 내놓지 않는다(위젯 안에서만 쓴다).
    static let isDiscoverable = false

    func perform() async throws -> some IntentResult {
        .result()
    }
}

/// 위젯 글. 기기 언어를 따르고(한국어 기본, 영어·일본어), 앱에서 고른 화면 언어와는 따로다. Android의 values*/widget_strings.xml과 같다.
struct WidgetText {
    let appName = "모도리"
    let name: String
    let description: String
    let titleFormat: String
    let none: String
    let moreFormat: String
    let needLogin: String
    let error: String
    let stale: String
    let refresh: String
    /// 위젯을 고르는 화면의 예시 할 일.
    let sampleTitles: [String]

    func title(_ count: Int) -> String { String(format: titleFormat, count) }
    func more(_ count: Int) -> String { String(format: moreFormat, count) }

    var sample: WidgetTodos {
        // lib/colors.ts의 초록·파랑·주황.
        let colors = ["#22c55e", "#2563eb", "#f97316"]
        let todos = sampleTitles.enumerated().map { index, title in
            WidgetTodo(id: "sample-\(index)", content: title, color: colors[index % colors.count], subDone: nil, subTotal: nil)
        }
        return WidgetTodos(remaining: todos.count, todos: todos)
    }

    static let current: WidgetText = {
        let language = Locale.preferredLanguages.first ?? ""
        if language.hasPrefix("en") { return english }
        if language.hasPrefix("ja") { return japanese }
        return korean
    }()

    private static let korean = WidgetText(
        name: "오늘 남은 할 일",
        description: "오늘 남은 할 일을 홈 화면에서 봐요",
        titleFormat: "오늘 남은 할 일 %d개",
        none: "오늘 남은 할 일이 없어요",
        moreFormat: "외 %d개",
        needLogin: "앱을 열어 로그인해 주세요",
        error: "할 일을 불러오지 못했어요. 새로 고침을 눌러 다시 해 보세요",
        stale: "새로 못 받음",
        refresh: "새로 고침",
        sampleTitles: ["장보기", "운동 30분", "책 읽기"]
    )

    private static let english = WidgetText(
        name: "Today's remaining todos",
        description: "See what's left to do today on your home screen",
        titleFormat: "%d left today",
        none: "Nothing left for today",
        moreFormat: "+%d more",
        needLogin: "Open the app and sign in",
        error: "Couldn't load your todos. Tap refresh to try again",
        stale: "not updated",
        refresh: "Refresh",
        sampleTitles: ["Groceries", "30-minute workout", "Read a book"]
    )

    private static let japanese = WidgetText(
        name: "今日の残りのやること",
        description: "今日の残りのやることをホーム画面で見ます",
        titleFormat: "今日の残り %d件",
        none: "今日の残りはありません",
        moreFormat: "ほか%d件",
        needLogin: "アプリを開いてログインしてください",
        error: "読み込めませんでした。更新を押して、もう一度お試しください",
        stale: "未更新",
        refresh: "更新",
        sampleTitles: ["買い物", "運動30分", "読書"]
    )
}

/// 웹의 토큰(app/globals.css의 surface·foreground·muted)과 같은 색. Android의 widget_colors.xml과도 같다.
struct WidgetPalette {
    let background: Color
    let text: Color
    let muted: Color

    init(dark: Bool) {
        background = WidgetPalette.rgb(dark ? 0x17191D : 0xFFFFFF)
        text = WidgetPalette.rgb(dark ? 0xEDEFF2 : 0x191F28)
        muted = WidgetPalette.rgb(dark ? 0x8B95A1 : 0x667080)
    }

    /// 색을 못 읽었을 때의 점. lib/colors.ts의 NO_CATEGORY_COLOR.
    static let fallbackDot = rgb(0x8B95A1)

    /// "#rrggbb". 모양이 다르면 nil.
    static func color(hex: String) -> Color? {
        guard hex.count == 7, hex.hasPrefix("#"), let value = UInt32(hex.dropFirst(), radix: 16) else { return nil }
        return rgb(value)
    }

    private static func rgb(_ value: UInt32) -> Color {
        Color(
            red: Double((value >> 16) & 0xFF) / 255,
            green: Double((value >> 8) & 0xFF) / 255,
            blue: Double(value & 0xFF) / 255
        )
    }
}
