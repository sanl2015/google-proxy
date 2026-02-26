export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  const url = new URL(req.url);
  
  // 动态获取你当前的代理域名 (例如: my-proxy.vercel.app)
  const myHost = req.headers.get('host');
  const targetHost = 'www.google.com';
  
  // 将请求目标指向 Google
  url.hostname = targetHost;

  // 1. 构造请求头，尽最大努力伪装并透传真实信息以缓解 CAPTCHA
  const headers = new Headers(req.headers);
  headers.set('Host', targetHost);
  headers.set('Referer', `https://${targetHost}/`);
  
  // 移除 Accept-Encoding，防止 Google 返回 Gzip/Brotli 压缩数据，导致我们无法执行正则替换
  headers.delete('Accept-Encoding');
  
  // 透传用户的真实 IP，降低被判定为恶意机器人的概率
  const clientIp = req.headers.get('x-real-ip') || req.headers.get('x-forwarded-for');
  if (clientIp) {
    headers.set('X-Forwarded-For', clientIp);
  }

  try {
    const response = await fetch(url.toString(), {
      method: req.method,
      headers: headers,
      body: req.body,
      redirect: 'manual', // 必须设置为 manual，由我们手动接管重定向
    });

    const responseHeaders = new Headers(response.headers);
    responseHeaders.set('Access-Control-Allow-Origin', '*');

    // 2. 拦截并重写重定向 (301/302/303)
    if (response.status >= 300 && response.status < 400) {
      let location = responseHeaders.get('location');
      if (location) {
        // 将重定向目标中的 Google 域名替换为我们的代理域名
        location = location.replace(`https://${targetHost}`, `https://${myHost}`);
        responseHeaders.set('location', location);
      }
    }

    // 3. 解决“绝对链接跳出”：拦截并重写 HTML 内容
    const contentType = responseHeaders.get('content-type') || '';
    if (contentType.includes('text/html')) {
      // 读取 HTML 纯文本
      let htmlText = await response.text();
      
      // 全局正则替换：将页面里的 https://www.google.com 换成我们的域名
      const domainRegex = new RegExp(`https://${targetHost}`, 'g');
      htmlText = htmlText.replace(domainRegex, `https://${myHost}`);
      
      // 可选：替换 /url?q= 这种跳转链接中的目标域名限制
      // 注意：这会增加性能开销，通常简单的域名替换就能覆盖大部分搜索点击需求

      return new Response(htmlText, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
      });
    }

    // 对于图片、CSS、JS 等非 HTML 资源，直接以数据流返回，保证速度
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });

  } catch (error) {
    return new Response(`Proxy Runtime Error: ${error.message}`, { status: 500 });
  }
}
