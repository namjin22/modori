// 웹 화면에 내주는 것은 창 다시 띄우기 하나뿐이다. Node나 Electron의 다른 기능은 넘기지 않는다.
// 컴퓨터 알림을 누르면 웹이 부른다(components/bottom-nav.tsx). 웹의 window.focus()로는 내려 둔 창이 올라오지 않는다.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("modoriDesktop", {
  focus: () => ipcRenderer.send("modori:focus"),
});
