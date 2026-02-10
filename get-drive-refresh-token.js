require('dotenv').config({ path: '.env.local' })
const { google } = require('googleapis')
const readline = require('readline')

const CLIENT_ID = process.env.GOOGLE_DRIVE_OAUTH_CLIENT_ID
const CLIENT_SECRET = process.env.GOOGLE_DRIVE_OAUTH_CLIENT_SECRET
const REDIRECT_URI = 'urn:ietf:wg:oauth:2.0:oob'
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

console.log('1) Open this URL in your browser:\n')
console.log(authUrl, '\n')
console.log('2) Approve access with the Google account that should receive the slides.')
console.log('3) You will see a code. Paste it here and press Enter.\n')

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })

rl.question('Paste the code here: ', async (code) => {
  rl.close()
  try {
    const { tokens } = await oAuth2Client.getToken(code.trim())
    console.log('\nTokens received:\n', tokens)
    console.log(
      '\nYour REFRESH TOKEN (put this into .env.local as GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN):\n'
    )
    console.log(
      tokens.refresh_token ||
        'NO refresh_token returned – make sure you used prompt=consent and access_type=offline.'
    )
  } catch (err) {
    console.error('Error getting tokens:', err)
  }
})

