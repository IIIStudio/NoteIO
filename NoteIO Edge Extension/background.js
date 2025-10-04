chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL('index.html') });
});

/**
 * 通过修改响应头来放行跨域（CORS）：
 * - 目标：允许扩展页面对 https://dav.jianguoyun.com/* 进行 GET/PUT 请求
 * - 添加 Access-Control-Allow-* 头以满足浏览器的预检与响应检查
 */
chrome.webRequest.onHeadersReceived.addListener(
  (details) => {
    // 仅处理目标域名的响应
    const responseHeaders = details.responseHeaders || [];
    // 移除可能已有的 ACAO 以避免重复冲突
    const filtered = responseHeaders.filter(
      (h) => !/^(access-control-allow-origin|access-control-allow-methods|access-control-allow-headers)$/i.test(h.name)
    );
    // 追加允许跨域的响应头
    filtered.push({ name: "Access-Control-Allow-Origin", value: "*" });
    filtered.push({ name: "Access-Control-Allow-Methods", value: "GET, PUT, OPTIONS" });
    filtered.push({ name: "Access-Control-Allow-Headers", value: "Authorization, Content-Type, Depth" });
    return { responseHeaders: filtered };
  },
  { urls: ["https://dav.jianguoyun.com/*"] },
  ["blocking", "responseHeaders"]
);