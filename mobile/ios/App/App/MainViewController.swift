import AuthenticationServices
import Capacitor
import UIKit

/// 모도리 iOS 앱의 화면. Capacitor 기본 화면(CAPBridgeViewController)에 아이폰 사용자 피드백으로 세 가지를 더한다.
/// 1) 배경색을 웹 화면과 같게 한다(라이트·다크). 기본은 iOS 시스템 색이라 다크 모드에서 시작할 때 검은 화면이 보였다.
/// 2) 웹 화면이 처음 그려질 때까지 시작 그림(Splash)을 덮어 둔다(웹이 Modori.pageReady로 알린다).
/// 3) 앱 안에서 뜨는 로그인 창(ModoriPlugin.signIn). 사파리로 넘어가지 않는다.
class MainViewController: CAPBridgeViewController {
    /// app/globals.css의 --color-background와 같은 색.
    static let background = UIColor { traits in
        traits.userInterfaceStyle == .dark
            ? UIColor(red: 14 / 255, green: 16 / 255, blue: 19 / 255, alpha: 1)
            : UIColor(red: 247 / 255, green: 248 / 255, blue: 250 / 255, alpha: 1)
    }

    private var splash: UIView?

    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(ModoriPlugin())
        webView?.backgroundColor = MainViewController.background
        webView?.scrollView.backgroundColor = MainViewController.background
    }

    override open func viewDidLoad() {
        super.viewDidLoad()
        showSplash()
        NotificationCenter.default.addObserver(
            self, selector: #selector(hideSplash), name: ModoriPlugin.pageReadyNotification, object: nil)
        // 웹이 알려 주지 못해도(서버 오류 화면 등) 계속 덮어 두지 않는다.
        DispatchQueue.main.asyncAfter(deadline: .now() + 8) { [weak self] in
            self?.hideSplash()
        }
    }

    /// 시작 화면(LaunchScreen.storyboard)과 같은 그림을 그대로 이어 붙인다. 바뀌는 순간이 보이지 않게 한다.
    private func showSplash() {
        let cover = UIView()
        cover.backgroundColor = MainViewController.background
        let image = UIImageView(image: UIImage(named: "Splash"))
        image.contentMode = .scaleAspectFill
        image.translatesAutoresizingMaskIntoConstraints = false
        cover.addSubview(image)
        cover.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(cover)
        NSLayoutConstraint.activate([
            cover.topAnchor.constraint(equalTo: view.topAnchor),
            cover.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            cover.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            cover.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            image.topAnchor.constraint(equalTo: cover.topAnchor),
            image.bottomAnchor.constraint(equalTo: cover.bottomAnchor),
            image.leadingAnchor.constraint(equalTo: cover.leadingAnchor),
            image.trailingAnchor.constraint(equalTo: cover.trailingAnchor),
        ])
        splash = cover
    }

    @objc private func hideSplash() {
        DispatchQueue.main.async { [weak self] in
            guard let cover = self?.splash else { return }
            self?.splash = nil
            UIView.animate(withDuration: 0.25, animations: { cover.alpha = 0 }, completion: { _ in cover.removeFromSuperview() })
        }
    }
}

/// 웹 화면이 부르는 모도리 전용 기능(window.Capacitor.Plugins.Modori).
@objc(ModoriPlugin)
public class ModoriPlugin: CAPPlugin, CAPBridgedPlugin, ASWebAuthenticationPresentationContextProviding {
    public let identifier = "ModoriPlugin"
    public let jsName = "Modori"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "pageReady", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "signIn", returnType: CAPPluginReturnPromise),
    ]

    static let pageReadyNotification = Notification.Name("ModoriPageReady")
    private var session: ASWebAuthenticationSession?

    /// 웹 화면이 처음 그려졌다. 시작 그림을 걷는다.
    @objc func pageReady(_ call: CAPPluginCall) {
        NotificationCenter.default.post(name: ModoriPlugin.pageReadyNotification, object: nil)
        call.resolve()
    }

    /// 앱 위에 뜨는 로그인 창(ASWebAuthenticationSession)으로 url을 열고, callbackScheme(modori://)으로 돌아오는 주소를 돌려준다.
    /// Google은 앱 안에 끼운 화면(WebView)에서의 로그인을 막아서, 이 시스템 로그인 창이 앱을 떠나지 않는 가장 가까운 방법이다.
    @objc func signIn(_ call: CAPPluginCall) {
        guard let raw = call.getString("url"), let url = URL(string: raw), let scheme = call.getString("callbackScheme") else {
            call.reject("url과 callbackScheme이 필요해요")
            return
        }
        DispatchQueue.main.async {
            let session = ASWebAuthenticationSession(url: url, callbackURLScheme: scheme) { [weak self] callback, error in
                self?.session = nil
                if let callback = callback {
                    call.resolve(["url": callback.absoluteString])
                } else if let authError = error as? ASWebAuthenticationSessionError, authError.code == .canceledLogin {
                    call.reject("로그인을 취소했어요", "CANCELED")
                } else {
                    call.reject(error?.localizedDescription ?? "로그인 창을 열지 못했어요")
                }
            }
            session.presentationContextProvider = self
            // 사파리와 로그인 상태를 같이 쓴다. 한 번 고른 Google 계정을 다시 입력하지 않아도 된다.
            session.prefersEphemeralWebBrowserSession = false
            self.session = session
            if !session.start() {
                self.session = nil
                call.reject("로그인 창을 열지 못했어요")
            }
        }
    }

    public func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        bridge?.viewController?.view.window ?? ASPresentationAnchor()
    }
}
