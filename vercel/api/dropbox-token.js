module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  try {
    const { code, redirectUri } = req.body || {};
    if (!code) {
      res.status(400).json({ error: 'Missing code' });
      return;
    }

    const client_id = process.env.DROPBOX_CLIENT_ID;
    const client_secret = process.env.DROPBOX_CLIENT_SECRET;
    if (!client_id || !client_secret) {
      res.status(500).json({ error: 'Missing environment variables' });
      return;
    }

    const params = new URLSearchParams({
      code,
      grant_type: 'authorization_code',
      client_id,
      client_secret,
      redirect_uri: redirectUri || ''
    });

    const r = await fetch('https://api.dropboxapi.com/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params
    });

    const text = await r.text();
    res.setHeader('Cache-Control', 'no-store');
    if (!r.ok) {
      res.status(r.status).send(text);
      return;
    }
    // 直接回传 Dropbox 返回内容（JSON 字符串）
    res.status(200).send(text);
  } catch (e) {
    res.status(500).json({ error: 'Token exchange failed', detail: String(e && e.message || e) });
  }
};