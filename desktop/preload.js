// 웹 화면에 내주는 것은 둘뿐이다: 창 다시 띄우기, 작업표시줄 아이콘에 알림 수 띄우기. Node나 Electron의 다른 기능은 넘기지 않는다.
// focus: 컴퓨터 알림을 누르면 웹이 부른다(components/bottom-nav.tsx). 웹의 window.focus()로는 내려 둔 창이 올라오지 않는다.
// setBadge: 안 읽은 알림 수와 그 숫자를 그린 PNG(lib/app-badge.ts)를 넘긴다. 받은 쪽(desktop/main.js)이 모양을 확인한다.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("modoriDesktop", {
  focus: () => ipcRenderer.send("modori:focus"),
  setBadge: (count, image) => ipcRenderer.send("modori:badge", count, image),
});
