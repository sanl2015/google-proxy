export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  const { searchParams, pathname } = new URL(req.url);
  
  // 核心修正：构造指向 Google 的完整 URL
  // 确保路径 (pathname) 和查询参数 (searchParams) 都被带上
  const targetHost = 'www.google.com';
  const targetUrl = new URL(pathname + searchParams.toString(), `https://${targetHost}`);
  
  const myHost = req.headers.get('host');

  // 1. 构造请求头
  const headers = new Headers(req.headers);
  headers.set('Host', targetHost);
  headers.set('Referer', `https://${targetHost}/`);
  headers.delete('Accept-Encoding'); // 方便正则替换

  try {
    // 使用构造好的 targetUrl 发起请求
    const response = await fetch(targetUrl.toString(), {
      method: req.method,
      headers: headers,
      body: req.body,
      redirect: 'manual',
    });

    // ... 后续的 response 处逻辑（重定向替换、HTML 替换）保持不变 ...
    // 直接复用上一条回复中关于 response.text() 替换的代码即可
