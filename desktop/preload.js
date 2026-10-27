// 웹 화면에 내주는 것은 두 묶음뿐이다. Node나 Electron의 다른 기능은 넘기지 않는다.
//
// modoriDesktop
// - focus: 컴퓨터 알림을 누르면 웹이 부른다(components/bottom-nav.tsx). 웹의 window.focus()로는 내려 둔 창이 올라오지 않는다.
// - setBadge: 안 읽은 알림 수와 그 숫자를 그린 PNG(lib/app-badge.ts)를 넘긴다. 받은 쪽(desktop/main.js)이 모양을 확인한다.
//
// modoriUpdater (앱 안 업데이트, desktop/updater.js. 웹의 components/desktop-update.tsx가 쓴다)
// - getState: 지금 상태. check: 새 버전이 있는지 확인. start: 받아서 설치하고 다시 시작.
// - onState: 상태가 바뀔 때마다 부른다. 돌려주는 함수를 부르면 그만 듣는다.
// 웹이 값을 넘기는 곳은 없다. 무엇을 어디서 받을지는 앱이 정한다.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("modoriDesktop", {
  focus: () => ipcRenderer.send("modori:focus"),
  setBadge: (count, image) => ipcRenderer.send("modori:badge", count, image),
});

contextBridge.exposeInMainWorld("modoriUpdater", {
  getState: () => ipcRenderer.invoke("modori:update-state"),
  check: () => ipcRenderer.send("modori:update-check"),
  start: () => ipcRenderer.send("modori:update-start"),
  onState: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on("modori:update-state", listener);
    return () => ipcRenderer.removeListener("modori:update-state", listener);
  },
});
