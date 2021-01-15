const fsp = require('fs').promises;
const readline = require('readline');
const { google } = require('googleapis');

/**
 * Create an OAuth2 client with the given credentials.
 * @param {Object} credentials The authorization client credentials.
 */
async function authorize(scopes, tokenPath, credentials) {
  const {client_secret, client_id, redirect_uris} = credentials.installed;
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

  // Check if we have previously stored a token.
  try {
    const token = await fsp.readFile(tokenPath);
    oAuth2Client.setCredentials(JSON.parse(token));
    return oAuth2Client;
  } catch (e) {
    console.error(e);
    return getNewToken(scopes, tokenPath, oAuth2Client);
  }
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
 */
async function getNewToken(scopes, tokenPath, oAuth2Client) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });

  console.log('Authorize this app by visiting this url:', authUrl);
  const code = await ask('Enter the code from that page here: ');
  let token = null;
  try {
    token = await getToken(oAuth2Client, code);
    oAuth2Client.setCredentials(token);
  } catch (e) {
    console.error('Error while fetching token.');
    console.error(e);
    return;
  }

  try {
    await fsp.writeFile(tokenPath, JSON.stringify(token));
    console.log('Token stored to', tokenPath);
  } catch (e) {
    console.error('Error while writing token.');
    console.error(e);
  }

  return oAuth2Client;
}

async function getToken(oAuth2Client, code) {
  return new Promise((resolve, reject) => {
    oAuth2Client.getToken(code, (err, token) => {
      if (err) {
        return reject(err);
      }
      oAuth2Client.setCredentials(token);
      resolve(token);
    });
  });
}

async function ask(prompt) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question('Enter the code from that page here: ', (code) => {
      rl.close();
      return resolve(code);
    });
  });
}

module.exports = {
  authorize
};
