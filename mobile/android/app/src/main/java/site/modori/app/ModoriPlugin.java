package site.modori.app;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** 웹 화면이 부르는 모도리 전용 기능(window.Capacitor.Plugins.Modori). iOS는 MainViewController.swift에 같은 이름이 있다. */
@CapacitorPlugin(name = "Modori")
public class ModoriPlugin extends Plugin {

    /** 웹 화면이 처음 그려졌는지. MainActivity가 시작 화면을 걷을 때 본다. */
    static volatile boolean pageReady = false;

    @PluginMethod
    public void pageReady(PluginCall call) {
        pageReady = true;
        call.resolve();
    }
}
