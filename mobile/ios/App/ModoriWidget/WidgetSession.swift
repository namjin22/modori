import Foundation
import os
import Security

/// 홈 화면 위젯이 서버(/api/widget)를 부를 때 싣는 로그인 쿠키. 앱과 위젯이 같이 쓰는 키체인 항목에 둔다(2026-11-21).
///
/// 위젯은 앱과 다른 프로세스라 앱 웹뷰의 쿠키 저장소를 읽지 못한다(Android 위젯은 같은 프로세스라 바로 읽는다).
/// 그래서 앱이 화면을 떠날 때(MainViewController.syncWidget) 웹뷰의 로그인 쿠키를 여기에 적고, 위젯은 여기서 읽는다.
/// 앱 그룹이 아니라 키체인 공유를 쓰는 까닭: 앱 그룹은 Apple 개발자 사이트에 그룹을 따로 등록해야 하는데, 키체인 공유는 같은 팀 안에서
/// 등록 없이 되고 서명은 CI가 알아서 만든다(docs/decisions.md).
/// 두 대상(App, ModoriWidget)의 entitlements에 같은 키체인 그룹 하나만 적어 두어서, 그룹을 적지 않고 쓰면 그 그룹에 들어간다
/// (Apple 키체인의 기본 그룹은 keychain-access-groups의 첫 항목이다).
enum WidgetSession {
    /// proxy.ts의 SESSION_COOKIES와 같다. 운영(https)에서는 앞의 것이다.
    static let cookieNames: Set<String> = ["__Secure-authjs.session-token", "authjs.session-token"]

    private struct Stored: Codable {
        /// "이름=값" 모양의 Cookie 헤더.
        let cookie: String
        /// 웹뷰 쿠키의 만료 시각. 지나면 웹뷰에서도 로그인이 풀리므로 위젯도 쓰지 않는다.
        let expires: Date?
    }

    private static let service = "site.modori.widget"
    private static let account = "session-cookie"
    private static let log = Logger(subsystem: "site.modori.app", category: "widget")

    private static var query: [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
    }

    struct ReadError: Error {
        let status: OSStatus
    }

    /// 위젯이 실을 Cookie 헤더. 없거나 만료됐으면 nil.
    /// 키체인을 읽지 못한 것(폰을 켜고 아직 한 번도 잠금을 풀지 않았을 때 등)은 "로그인 없음"과 다르니 던진다.
    static func load() throws -> String? {
        var search = query
        search[kSecReturnData as String] = true
        search[kSecMatchLimit as String] = kSecMatchLimitOne
        var result: CFTypeRef?
        let status = SecItemCopyMatching(search as CFDictionary, &result)
        if status == errSecItemNotFound { return nil }
        guard status == errSecSuccess, let data = result as? Data else {
            log.error("키체인에서 로그인 쿠키를 읽지 못했다: \(status)")
            throw ReadError(status: status)
        }
        do {
            let stored = try JSONDecoder().decode(Stored.self, from: data)
            if let expires = stored.expires, expires < Date() { return nil }
            return stored.cookie
        } catch {
            log.error("키체인의 로그인 쿠키가 깨져 있다: \(error.localizedDescription, privacy: .public)")
            return nil
        }
    }

    static func save(_ cookie: HTTPCookie) {
        let data: Data
        do {
            data = try JSONEncoder().encode(Stored(cookie: "\(cookie.name)=\(cookie.value)", expires: cookie.expiresDate))
        } catch {
            log.error("로그인 쿠키를 저장할 모양으로 바꾸지 못했다: \(error.localizedDescription, privacy: .public)")
            return
        }
        let update = SecItemUpdate(query as CFDictionary, [kSecValueData as String: data] as CFDictionary)
        if update == errSecSuccess { return }
        guard update == errSecItemNotFound else {
            log.error("키체인의 로그인 쿠키를 고치지 못했다: \(update)")
            return
        }
        var item = query
        item[kSecValueData as String] = data
        // 잠긴 폰에서도 위젯이 읽게 처음 잠금 해제 뒤부터 열고, 백업으로 다른 기기에 옮겨 가지 않게 이 기기에만 둔다.
        item[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        let add = SecItemAdd(item as CFDictionary, nil)
        if add != errSecSuccess {
            log.error("키체인에 로그인 쿠키를 넣지 못했다: \(add)")
        }
    }

    static func clear() {
        let status = SecItemDelete(query as CFDictionary)
        if status != errSecSuccess && status != errSecItemNotFound {
            log.error("키체인의 로그인 쿠키를 지우지 못했다: \(status)")
        }
    }
}
