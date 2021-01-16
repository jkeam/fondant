const fsp = require('fs').promises;
const { authorize } = require('./lib/auth');
const { read } = require('./lib/sheet');
const { db } = require('./lib/db');

require('dotenv').config()
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const RANGE = process.env.RANGE || '';
const CREDENTIALS_PATH = process.env.CREDENTIALS_PATH || 'credentials.json';
const TOKEN_PATH = process.env.TOKEN_PATH || 'token.json';
const scope = process.env.READ_ONLY_SCOPE || 'https://www.googleapis.com/auth/spreadsheets.readonly';
const SCOPES = [scope];   // If modifying these scopes, delete token.json.

(async () => {
  try {
    const content = await fsp.readFile(CREDENTIALS_PATH);
    const authClient = await authorize(SCOPES, TOKEN_PATH, JSON.parse(content));
    const sheets = await read(SPREADSHEET_ID, authClient, RANGE.split(',').map(i => i.trim()));

    for (const sheet of sheets) {
      const { headers, originalHeaders, rows, models, name } = sheet;
      console.log(name);
      console.log('----------------');
      models.forEach(model => console.log(model));
    }
  } catch (e) {
    console.error(e);
  }
})();
