package site.modori.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.os.Bundle;
import android.text.Spannable;
import android.text.SpannableStringBuilder;
import android.text.style.ForegroundColorSpan;
import android.util.Log;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.WebSettings;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

/**
 * 홈 화면 위젯: 오늘 남은 할 일을 보여 준다(2026-11-20 운영자 요청, 읽기 전용. docs/decisions.md).
 *
 * 목록과 개수는 서버가 정해 준다(GET /api/widget, lib/widget.ts). 여기에는 할 일 규칙이 없다.
 * 부를 때는 앱 웹뷰가 가진 로그인 쿠키를 그대로 싣는다. 위젯은 앱과 같은 프로세스에서 돌아 웹뷰의 쿠키 저장소(CookieManager)를 읽을 수 있고,
 * 그래서 위젯용 토큰·로그인 화면·네이티브 플러그인이 따로 필요 없다. 대신 앱에서 로그아웃했거나 로그인이 만료되면(마지막으로 앱을 쓰고 한 달쯤 뒤)
 * "앱을 열어 로그인해 주세요"가 뜬다.
 *
 * 새로 고침: 30분마다(시스템이 정하는 최소 간격), 위젯의 새로 고침 단추, 앱 화면을 떠날 때(MainActivity.onPause).
 * 못 받으면 12시간 안의 마지막 목록을 "새로 못 받음" 표시와 함께 보여 주고, 더 오래됐으면 오류 문구를 보여 준다.
 * 마지막으로 받은 목록(할 일 제목·색·개수)은 이 앱 전용 저장소(SharedPreferences)에만 두고 서버로 보내지 않는다.
 * 위젯을 모두 지우거나 로그인이 풀리면 지운다(docs/privacy-inventory.md).
 */
public class ModoriWidgetProvider extends AppWidgetProvider {

    static final String ACTION_REFRESH = "site.modori.app.WIDGET_REFRESH";

    private static final String TAG = "ModoriWidget";
    // capacitor.config.json의 server.url과 같은 운영 주소. 쿠키도 이 주소의 것을 읽는다.
    private static final String BASE_URL = "https://modori.site";
    private static final String ENDPOINT = BASE_URL + "/api/widget";
    private static final String PREFS = "modori_widget";
    private static final String KEY_CACHE = "cache";
    private static final String KEY_FETCHED_AT = "fetchedAt";
    private static final long CACHE_MAX_AGE_MS = 12L * 60 * 60 * 1000;
    // 방송 수신기는 10초 안에 끝나야 한다(goAsync도 같다). 연결 4초 + 읽기 5초로 묶는다.
    private static final int CONNECT_TIMEOUT_MS = 4000;
    private static final int READ_TIMEOUT_MS = 5000;
    private static final int MAX_BODY_BYTES = 64 * 1024;
    private static final int FALLBACK_COLOR = Color.rgb(0x8b, 0x95, 0xa1);

    // 레이아웃(widget_todos.xml)의 줄 수와 같아야 한다.
    private static final int[] ROW_IDS = {
        R.id.widget_row0, R.id.widget_row1, R.id.widget_row2, R.id.widget_row3, R.id.widget_row4, R.id.widget_row5, R.id.widget_row6,
    };
    // 높이를 모를 때의 줄 수, 줄 하나·위젯 머리와 여백이 차지하는 높이(dp). 위젯 크기에 맞춰 보여 줄 줄 수를 정한다.
    private static final int DEFAULT_ROWS = 4;
    private static final int ROW_DP = 26;
    private static final int CHROME_DP = 72;

    private enum Status { LOADING, OK, NEED_LOGIN, ERROR }

    private static final class Row {
        final String text;
        final int color;
        // 세부 할 일이 있으면 "1/3". 없으면 null.
        final String progress;

        Row(String text, int color, String progress) {
            this.text = text;
            this.color = color;
            this.progress = progress;
        }
    }

    private static final class Snapshot {
        final int remaining;
        final List<Row> rows;

        Snapshot(int remaining, List<Row> rows) {
            this.remaining = remaining;
            this.rows = rows;
        }
    }

    private static final class FetchResult {
        final Status status;
        final String json;
        final Snapshot snapshot;

        FetchResult(Status status, String json, Snapshot snapshot) {
            this.status = status;
            this.json = json;
            this.snapshot = snapshot;
        }
    }

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] appWidgetIds) {
        refresh(context, goAsync());
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        if (ACTION_REFRESH.equals(intent.getAction())) {
            refresh(context, goAsync());
            return;
        }
        super.onReceive(context, intent);
    }

    @Override
    public void onAppWidgetOptionsChanged(Context context, AppWidgetManager manager, int appWidgetId, Bundle newOptions) {
        // 크기를 바꾸면 보여 줄 줄 수가 달라진다. 마지막으로 받은 목록으로 바로 다시 그리고 새로 받는다.
        refresh(context, goAsync());
    }

    @Override
    public void onDisabled(Context context) {
        // 마지막 위젯을 지웠다. 마지막으로 받은 목록도 지운다.
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().clear().apply();
    }

    /** 앱 화면을 떠날 때 부른다. 위젯이 하나도 없으면 수신기가 바로 끝낸다. */
    static void refreshAll(Context context) {
        context.sendBroadcast(new Intent(context, ModoriWidgetProvider.class).setAction(ACTION_REFRESH));
    }

    private static void refresh(Context context, final PendingResult pending) {
        final Context app = context.getApplicationContext();
        final AppWidgetManager manager = AppWidgetManager.getInstance(app);
        final int[] ids = manager.getAppWidgetIds(new ComponentName(app, ModoriWidgetProvider.class));
        if (ids.length == 0) {
            if (pending != null) pending.finish();
            return;
        }

        // 쿠키와 사용자 에이전트는 웹뷰와 같은 곳에서 읽는다. 웹뷰를 쓰는 일이라 메인 스레드에서 읽는다.
        String cookie = null;
        String agent = "ModoriWidget/1";
        try {
            cookie = CookieManager.getInstance().getCookie(BASE_URL);
            // 일반 안드로이드 브라우저와 같은 모양에 표시만 붙인다(밖의 방화벽이 낯선 에이전트를 막지 않게).
            agent = WebSettings.getDefaultUserAgent(app) + " ModoriWidget/1";
        } catch (RuntimeException error) {
            // 웹뷰가 업데이트 중이면 쿠키 저장소를 못 연다. 이번에는 못 받은 것으로 두고 다음 새로 고침을 기다린다.
            Log.w(TAG, "웹뷰 쿠키 저장소를 열지 못했다.", error);
        }
        final String cookieHeader = cookie;
        final String userAgent = agent;

        // 새로 받는 동안 빈 위젯이 보이지 않게 마지막 목록으로 먼저 그린다.
        Snapshot cached = readCache(app);
        render(app, manager, ids, cached == null ? Status.LOADING : Status.OK, cached, false);

        new Thread(() -> {
            try {
                FetchResult result = fetch(cookieHeader, userAgent);
                SharedPreferences prefs = app.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
                if (result.status == Status.OK) {
                    prefs.edit().putString(KEY_CACHE, result.json).putLong(KEY_FETCHED_AT, System.currentTimeMillis()).apply();
                    render(app, manager, ids, Status.OK, result.snapshot, false);
                } else if (result.status == Status.NEED_LOGIN) {
                    // 로그아웃·만료. 남아 있는 목록을 지워 다른 사람이 위젯으로 보지 못하게 한다.
                    prefs.edit().clear().apply();
                    render(app, manager, ids, Status.NEED_LOGIN, null, false);
                } else {
                    Snapshot fallback = readCache(app);
                    render(app, manager, ids, fallback == null ? Status.ERROR : Status.OK, fallback, fallback != null);
                }
            } catch (RuntimeException error) {
                Log.w(TAG, "위젯을 그리다 멈췄다.", error);
            } finally {
                if (pending != null) pending.finish();
            }
        }, "modori-widget").start();
    }

    private static FetchResult fetch(String cookie, String userAgent) {
        if (cookie == null || cookie.isEmpty()) return new FetchResult(Status.NEED_LOGIN, null, null);
        HttpURLConnection connection = null;
        try {
            connection = (HttpURLConnection) new URL(ENDPOINT).openConnection();
            connection.setConnectTimeout(CONNECT_TIMEOUT_MS);
            connection.setReadTimeout(READ_TIMEOUT_MS);
            connection.setInstanceFollowRedirects(false);
            connection.setRequestProperty("Cookie", cookie);
            connection.setRequestProperty("Accept", "application/json");
            connection.setRequestProperty("User-Agent", userAgent);
            int code = connection.getResponseCode();
            // 로그인이 풀린 것은 401뿐이다. 방화벽 검문(403)이나 서버 오류는 오류로 두고 마지막 목록을 보여 준다.
            if (code == 401) return new FetchResult(Status.NEED_LOGIN, null, null);
            if (code != 200) {
                Log.w(TAG, "서버가 " + code + "로 답했다.");
                return new FetchResult(Status.ERROR, null, null);
            }
            String body = readBody(connection.getInputStream());
            // 모양이 틀린 응답은 캐시에 넣지 않는다.
            return new FetchResult(Status.OK, body, parse(body));
        } catch (IOException | JSONException error) {
            Log.w(TAG, "할 일을 받지 못했다.", error);
            return new FetchResult(Status.ERROR, null, null);
        } finally {
            if (connection != null) connection.disconnect();
        }
    }

    private static String readBody(InputStream input) throws IOException {
        try (InputStream stream = input) {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buffer = new byte[4096];
            int read;
            while ((read = stream.read(buffer)) != -1) {
                out.write(buffer, 0, read);
                if (out.size() > MAX_BODY_BYTES) throw new IOException("응답이 너무 크다.");
            }
            return out.toString(StandardCharsets.UTF_8.name());
        }
    }

    private static Snapshot parse(String json) throws JSONException {
        JSONObject root = new JSONObject(json);
        JSONArray todos = root.getJSONArray("todos");
        List<Row> rows = new ArrayList<>();
        for (int i = 0; i < todos.length(); i++) {
            JSONObject todo = todos.getJSONObject(i);
            String progress = todo.has("subTotal") ? todo.optInt("subDone", 0) + "/" + todo.getInt("subTotal") : null;
            rows.add(new Row(todo.getString("content"), parseColor(todo.optString("color", "")), progress));
        }
        return new Snapshot(root.getInt("remaining"), rows);
    }

    private static int parseColor(String value) {
        try {
            return Color.parseColor(value);
        } catch (RuntimeException error) {
            // 빈 값·모르는 모양. 회색 점으로 보인다.
            return FALLBACK_COLOR;
        }
    }

    /** 12시간 안에 받은 마지막 목록. 없거나 낡았거나 깨졌으면 null. */
    private static Snapshot readCache(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String json = prefs.getString(KEY_CACHE, null);
        long fetchedAt = prefs.getLong(KEY_FETCHED_AT, 0);
        if (json == null || System.currentTimeMillis() - fetchedAt > CACHE_MAX_AGE_MS) return null;
        try {
            return parse(json);
        } catch (JSONException error) {
            Log.w(TAG, "저장해 둔 목록이 깨져 있다.", error);
            return null;
        }
    }

    private static void render(Context context, AppWidgetManager manager, int[] ids, Status status, Snapshot snapshot, boolean stale) {
        for (int id : ids) {
            manager.updateAppWidget(id, buildViews(context, manager.getAppWidgetOptions(id), status, snapshot, stale));
        }
    }

    private static RemoteViews buildViews(Context context, Bundle options, Status status, Snapshot snapshot, boolean stale) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_todos);
        views.setOnClickPendingIntent(R.id.widget_root, openApp(context));
        views.setOnClickPendingIntent(R.id.widget_refresh, refreshIntent(context));

        String title = context.getString(R.string.app_name);
        String message = null;
        int shown = 0;
        if (status == Status.LOADING) {
            message = context.getString(R.string.widget_loading);
        } else if (status == Status.NEED_LOGIN) {
            message = context.getString(R.string.widget_need_login);
        } else if (status == Status.ERROR || snapshot == null) {
            message = context.getString(R.string.widget_error);
        } else if (snapshot.remaining == 0) {
            title = context.getString(R.string.widget_none);
        } else {
            title = context.getString(R.string.widget_title, snapshot.remaining);
            shown = Math.min(rowsThatFit(options), snapshot.rows.size());
        }
        if (stale) title = title + " · " + context.getString(R.string.widget_stale);
        views.setTextViewText(R.id.widget_title, title);

        views.setViewVisibility(R.id.widget_message, message == null ? View.GONE : View.VISIBLE);
        if (message != null) views.setTextViewText(R.id.widget_message, message);

        for (int i = 0; i < ROW_IDS.length; i++) {
            if (i < shown) {
                views.setViewVisibility(ROW_IDS[i], View.VISIBLE);
                views.setTextViewText(ROW_IDS[i], rowText(context, snapshot.rows.get(i)));
            } else {
                views.setViewVisibility(ROW_IDS[i], View.GONE);
            }
        }

        // 서버가 알려 준 남은 개수에서 보여 준 줄을 뺀 만큼이 "외 N개"다(서버는 20줄까지만 내려 주지만 개수는 전체다).
        int more = (status == Status.OK && snapshot != null) ? snapshot.remaining - shown : 0;
        views.setViewVisibility(R.id.widget_more, more > 0 ? View.VISIBLE : View.GONE);
        if (more > 0) views.setTextViewText(R.id.widget_more, context.getString(R.string.widget_more, more));
        return views;
    }

    private static CharSequence rowText(Context context, Row row) {
        SpannableStringBuilder text = new SpannableStringBuilder("● ");
        text.setSpan(new ForegroundColorSpan(row.color), 0, 1, Spannable.SPAN_EXCLUSIVE_EXCLUSIVE);
        text.append(row.text);
        if (row.progress != null) {
            int start = text.length();
            text.append("  ").append(row.progress);
            text.setSpan(new ForegroundColorSpan(context.getColor(R.color.widget_muted)), start, text.length(), Spannable.SPAN_EXCLUSIVE_EXCLUSIVE);
        }
        return text;
    }

    private static int rowsThatFit(Bundle options) {
        int heightDp = options == null ? 0 : options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 0);
        if (heightDp <= 0) return DEFAULT_ROWS;
        return Math.max(1, Math.min(ROW_IDS.length, (heightDp - CHROME_DP) / ROW_DP));
    }

    private static PendingIntent openApp(Context context) {
        Intent launch = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
        if (launch == null) launch = new Intent(context, MainActivity.class);
        return PendingIntent.getActivity(context, 0, launch, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    private static PendingIntent refreshIntent(Context context) {
        Intent refresh = new Intent(context, ModoriWidgetProvider.class).setAction(ACTION_REFRESH);
        return PendingIntent.getBroadcast(context, 0, refresh, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }
}
