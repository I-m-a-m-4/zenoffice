const { google } = require('googleapis');
const http = require('http');
const url = require('url');
require('dotenv').config();

const CLIENT_ID = process.env.GMAIL_CLIENT_ID;
const CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET;
const REDIRECT_URI = 'http://localhost:5000';

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("Missing GMAIL_CLIENT_ID or GMAIL_CLIENT_SECRET in .env file!");
  process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
);

const scopes = [
  'https://mail.google.com/'
];

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent', // Force consent screen to ensure we get a refresh token
  scope: scopes,
});

console.log('----------------------------------------------------');
console.log('1. Click this link to authorize the app:');
console.log(authUrl);
console.log('----------------------------------------------------');
console.log('Waiting for you to sign in... (Make sure to sign in with zenevapos@gmail.com)');

const server = http.createServer(async (req, res) => {
  if (req.url.startsWith('/?code=')) {
    const qs = new url.URL(req.url, 'http://localhost:5000').searchParams;
    const code = qs.get('code');
    
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<h1>Authentication successful!</h1><p>You can close this tab and check your terminal.</p>');
    
    server.close();
    
    try {
      const { tokens } = await oauth2Client.getToken(code);
      console.log('\n✅ SUCCESS! Here is your new Refresh Token:\n');
      console.log(tokens.refresh_token);
      console.log('\nCopy the token above and paste it into your .env file as GMAIL_REFRESH_TOKEN.');
      console.log('Don\'t forget to also update it in Vercel!');
      process.exit(0);
    } catch (err) {
      console.error('Error retrieving access token', err);
      process.exit(1);
    }
  }
}).listen(5000, () => {
  // Server is listening
});
