import Foundation
import os

/// 서버가 정해 주는 오늘 남은 할 일(GET /api/widget, lib/widget.ts의 buildWidget). 여기에는 할 일 규칙이 없다.
struct WidgetTodos: Codable {
    /// 남은 할 일 전체 개수. todos는 앞의 20개까지만 온다.
    let remaining: Int
    let todos: [WidgetTodo]
}

struct WidgetTodo: Codable, Identifiable {
    let id: String
    let content: String
    /// "#rrggbb"
    let color: String
    let subDone: Int?
    let subTotal: Int?
}

enum TodosState {
    /// stale: 이번에 못 받아서 12시간 안의 마지막 목록을 보여 준다.
    case ok(WidgetTodos, stale: Bool)
    case needLogin
    case error
}

/// 위젯이 그릴 것을 받는다. 동작은 Android 위젯(ModoriWidgetProvider.java)과 같다.
/// 로그인이 풀린 것(401)이 확인되면 마지막 목록을 지우고, 그 밖의 실패는 12시간 안의 마지막 목록을 "새로 못 받음"과 함께 보여 준다.
enum TodosLoader {
    // capacitor.config.json의 server.url과 같은 운영 주소.
    private static let endpoint = URL(string: "https://modori.site/api/widget")!
    private static let maxBodyBytes = 64 * 1024
    private static let log = Logger(subsystem: "site.modori.app", category: "widget")

    private static let session: URLSession = {
        // 위젯 쪽에 쿠키·응답을 따로 남기지 않는다. 로그인 쿠키는 WidgetSession에서 매번 꺼내 싣는다.
        let configuration = URLSessionConfiguration.ephemeral
        configuration.httpShouldSetCookies = false
        configuration.httpCookieAcceptPolicy = .never
        configuration.urlCache = nil
        configuration.timeoutIntervalForRequest = 10
        return URLSession(configuration: configuration)
    }()

    static func load() async -> TodosState {
        guard let cookie = WidgetSession.load() else {
            TodosCache.clear()
            return .needLogin
        }
        var request = URLRequest(url: endpoint)
        request.httpShouldHandleCookies = false
        request.setValue(cookie, forHTTPHeaderField: "Cookie")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        do {
            let (data, response) = try await session.data(for: request, delegate: NoRedirect())
            let code = (response as? HTTPURLResponse)?.statusCode ?? 0
            // 로그인이 풀린 것은 401뿐이다. 방화벽 검문(403)이나 서버 오류는 오류로 두고 마지막 목록을 보여 준다.
            if code == 401 {
                // 남아 있는 목록을 지워 다른 사람이 위젯으로 보지 못하게 한다.
                TodosCache.clear()
                return .needLogin
            }
            guard code == 200 else {
                log.error("서버가 \(code)로 답했다.")
                return fallback()
            }
            guard data.count <= maxBodyBytes else {
                log.error("응답이 너무 크다: \(data.count)바이트")
                return fallback()
            }
            let todos = try JSONDecoder().decode(WidgetTodos.self, from: data)
            TodosCache.save(todos)
            return .ok(todos, stale: false)
        } catch {
            log.error("할 일을 받지 못했다: \(error.localizedDescription, privacy: .public)")
            return fallback()
        }
    }

    private static func fallback() -> TodosState {
        if let cached = TodosCache.load() { return .ok(cached, stale: true) }
        return .error
    }
}

/// 주소가 옮겨지면(로그인 화면 등) 따라가지 않는다. 로그인 쿠키를 다른 곳에 싣지 않고, 실패로 본다.
private final class NoRedirect: NSObject, URLSessionTaskDelegate {
    func urlSession(
        _ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse,
        newRequest request: URLRequest
    ) async -> URLRequest? {
        nil
    }
}

/// 마지막으로 받은 목록. 위젯 확장의 캐시 폴더에만 두고 서버로 보내지 않는다(docs/privacy-inventory.md).
enum TodosCache {
    private struct Stored: Codable {
        let fetchedAt: Date
        let todos: WidgetTodos
    }

    private static let maxAge: TimeInterval = 12 * 60 * 60
    private static let log = Logger(subsystem: "site.modori.app", category: "widget")

    private static var file: URL? {
        FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first?.appendingPathComponent("modori-widget.json")
    }

    static func save(_ todos: WidgetTodos) {
        guard let file else { return }
        do {
            let data = try JSONEncoder().encode(Stored(fetchedAt: Date(), todos: todos))
            try data.write(to: file, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
        } catch {
            log.error("마지막 목록을 저장하지 못했다: \(error.localizedDescription, privacy: .public)")
        }
    }

    /// 12시간 안에 받은 마지막 목록. 없거나 낡았거나 깨졌으면 nil.
    static func load() -> WidgetTodos? {
        guard let file, FileManager.default.fileExists(atPath: file.path) else { return nil }
        do {
            let stored = try JSONDecoder().decode(Stored.self, from: Data(contentsOf: file))
            return Date().timeIntervalSince(stored.fetchedAt) <= maxAge ? stored.todos : nil
        } catch {
            log.error("저장해 둔 목록이 깨져 있다: \(error.localizedDescription, privacy: .public)")
            return nil
        }
    }

    static func clear() {
        guard let file, FileManager.default.fileExists(atPath: file.path) else { return }
        do {
            try FileManager.default.removeItem(at: file)
        } catch {
            log.error("마지막 목록을 지우지 못했다: \(error.localizedDescription, privacy: .public)")
        }
    }
}
