const fsp = require('fs').promises;
const { authorize } = require('./lib/auth');
const { read } = require('./lib/sheet');
const { db, createDatabase, search } = require('./lib/db');

require('dotenv').config()
const SPREADSHEET_ID = process.env.SPREADSHEET_ID || '';
const RANGE = process.env.RANGE || '';
const SEARCH_FIELD = process.env.SEARCH_FIELD || '';
const CREDENTIALS_PATH = process.env.CREDENTIALS_PATH || 'credentials.json';
const TOKEN_PATH = process.env.TOKEN_PATH || 'token.json';
const JSON_PATH = process.env.JSON_PATH || 'database.json';
const scope = process.env.READ_ONLY_SCOPE || 'https://www.googleapis.com/auth/spreadsheets.readonly';
const SCOPES = [scope];   // If modifying these scopes, delete token.json.

(async () => {
  try {

    // validate
    if (SPREADSHEET_ID === '') {
      console.error('Missing SPREADSHEET_ID env var');
      return;
    }
    if (RANGE === '') {
      console.error('Missing RANGE env var');
      return;
    }

    /**
     *  Debug function
     *  @param {string} name Title of the data dumped
     *  @param {Array} models Models to print out
     */
    const dump = (name, models) => {
      console.log(name);
      console.log('----------------');
      for (const model of models) {
        console.log(model);
      }
    };

    /**
     *  Destructively recreate database.
     */
    const createDatastore = async () => {
      const content = await fsp.readFile(CREDENTIALS_PATH);
      const authClient = await authorize(SCOPES, TOKEN_PATH, JSON.parse(content));
      const sheets = await read(SPREADSHEET_ID, authClient, RANGE.split(',').map(i => i.trim()));
      return await createDatabase(authClient, sheets, JSON_PATH);
    };

    /**
     *  Find matching rows.
     *
     *  @param {string} term Search term
     *  @returns {Object[]} Return matching rows
     */
    const find = async (term) => {
      const sheets = JSON.parse(await fsp.readFile(JSON_PATH));
      return search(sheets, SEARCH_FIELD, term);
    };

    // main
    // await createDatastore();
    const results = await find('ansible');
    console.log(results);
  } catch (e) {
    console.error(e);
  }
})();
