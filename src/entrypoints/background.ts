// Background service worker.
// 词典随扩展打包分发（加密），不需要远端拉取；这里只在首次安装时初始化默认开关。

export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(async (details) => {
    if (details.reason === "install") {
      await browser.storage.local.set({ decodeEnabled: true });
    }
  });
});
