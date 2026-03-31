require('dotenv').config({ path: '.env.local' })
const { google } = require('googleapis')
const http = require('http')
const url = require('url')

const CLIENT_ID = process.env.GOOGLE_DRIVE_OAUTH_CLIENT_ID
const CLIENT_SECRET = process.env.GOOGLE_DRIVE_OAUTH_CLIENT_SECRET
const REDIRECT_URI = 'http://localhost:3000/oauth/callback'
const SCOPES = ['https://www.googleapis.com/auth/drive.file']

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error(
    'Set GOOGLE_DRIVE_OAUTH_CLIENT_ID and GOOGLE_DRIVE_OAUTH_CLIENT_SECRET in .env.local first.'
  )
  process.exit(1)
}

const oAuth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI)
const authUrl = oAuth2Client.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent',
  scope: SCOPES,
})

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true)
  if (parsed.pathname !== '/oauth/callback') {
    res.end('Not found')
    return
  }

  const code = parsed.query.code
  if (!code) {
    res.end('No code found in request.')
    return
  }

  try {
    const { tokens } = await oAuth2Client.getToken(code)
    const refresh = tokens.refresh_token ||
      'NO refresh_token returned – try again (make sure to revoke access first at myaccount.google.com/permissions).'

    console.log('\n✅ Success! Your refresh token:\n')
    console.log(refresh)
    console.log('\nPaste this into Render → GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN and redeploy.')

    res.writeHead(200, { 'Content-Type': 'text/html' })
    res.end(`<h2>✅ Success!</h2><p>Your refresh token:</p><pre style="word-break:break-all">${refresh}</pre><p>Copy it into Render → <b>GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN</b> and redeploy.</p>`)
  } catch (err) {
    console.error('Error getting tokens:', err.message)
    res.end('Error: ' + err.message)
  } finally {
    server.close()
  }
})

server.listen(3000, () => {
  console.log('1) Make sure http://localhost:3000/oauth/callback is in your Google Cloud OAuth redirect URIs.')
  console.log('   (Google Cloud Console → APIs & Services → Credentials → your OAuth client → Authorised redirect URIs)\n')
  console.log('2) Open this URL in your browser:\n')
  console.log(authUrl)
  console.log('\n3) Sign in and approve — your refresh token will appear here and in the browser.\n')
})
