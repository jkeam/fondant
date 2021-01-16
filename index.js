const fsp = require('fs').promises;
const { authorize } = require('./lib/auth');
const { read } = require('./lib/sheet');
const { db, createCollection } = require('./lib/db');

require('dotenv').config()
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const RANGE = process.env.RANGE || '';
const CREDENTIALS_PATH = process.env.CREDENTIALS_PATH || 'credentials.json';
const TOKEN_PATH = process.env.TOKEN_PATH || 'token.json';
const scope = process.env.READ_ONLY_SCOPE || 'https://www.googleapis.com/auth/spreadsheets.readonly';
const SCOPES = [scope];   // If modifying these scopes, delete token.json.

(async () => {
  try {
    const dump = (name, models) => {
      console.log(name);
      console.log('----------------');
      for (const model of models) {
        console.log(model);
      }
    };

    const content = await fsp.readFile(CREDENTIALS_PATH);
    const authClient = await authorize(SCOPES, TOKEN_PATH, JSON.parse(content));
    const sheets = await read(SPREADSHEET_ID, authClient, RANGE.split(',').map(i => i.trim()));

    await db.drop();
    for (const sheet of sheets) {
      const { headers, originalHeaders, rows, models, name } = sheet;
      const collection = await createCollection(name, headers, { force: true });
      for (const model of models) {
        await collection.create(model);
      }
    }
  } catch (e) {
    console.error(e);
  }
})();
