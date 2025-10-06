module.exports = (req, res) => {
  const clientId = process.env.DROPBOX_CLIENT_ID || null;
  // 优先使用环境变量中的重定向地址；否则根据请求头推断（用于预览）
  const forwardedProto = req.headers['x-forwarded-proto'];
  const forwardedHost = req.headers['x-forwarded-host'];
  const inferred = (forwardedProto && forwardedHost) ? `${forwardedProto}://${forwardedHost}/` : null;
  const redirectUri = process.env.DROPBOX_REDIRECT_URI || inferred || null;

  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({ clientId, redirectUri });
};