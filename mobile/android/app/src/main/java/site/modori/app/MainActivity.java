package site.modori.app;

import android.content.res.Configuration;
import android.graphics.Color;
import android.os.Bundle;
import android.os.SystemClock;
import androidx.core.splashscreen.SplashScreen;
import com.getcapacitor.BridgeActivity;

/**
 * 모도리 안드로이드 앱의 화면. Capacitor 기본 화면에 아이폰과 같이 두 가지를 더한다(mobile/ios/App/App/MainViewController.swift).
 * 1) 웹 화면이 처음 그려질 때까지 시작 화면을 붙잡아 둔다. 안 그러면 서버에서 화면을 받는 동안 빈 흰 화면이 보였다.
 *    웹이 Modori.pageReady로 알리고, 알리지 못해도 8초 뒤에는 걷는다.
 * 2) 앱 배경을 웹 배경과 같은 색(라이트·다크)으로 둔다. 다크 모드에서 흰 화면이 번쩍이지 않게 한다.
 */
public class MainActivity extends BridgeActivity {

    private static final long SPLASH_MAX_MS = 8000;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        ModoriPlugin.pageReady = false;
        final long startedAt = SystemClock.uptimeMillis();
        SplashScreen splash = SplashScreen.installSplashScreen(this);
        splash.setKeepOnScreenCondition(() -> !ModoriPlugin.pageReady && SystemClock.uptimeMillis() - startedAt < SPLASH_MAX_MS);

        registerPlugin(ModoriPlugin.class);
        super.onCreate(savedInstanceState);

        // app/globals.css의 --color-background와 같은 색.
        boolean night = (getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES;
        int background = night ? Color.rgb(14, 16, 19) : Color.rgb(247, 248, 250);
        getWindow().getDecorView().setBackgroundColor(background);
        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().setBackgroundColor(background);
        }
    }
}
