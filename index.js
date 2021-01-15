const fsp = require('fs').promises;
const { authorize } = require('./lib/auth');
const { read } = require('./lib/sheet');

require('dotenv').config()
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const CREDENTIALS_PATH = process.env.CREDENTIALS_PATH;
const TOKEN_PATH = process.env.TOKEN_PATH;
const SCOPES = [process.env.READ_ONLY_SCOPE];   // If modifying these scopes, delete token.json.

(async () => {
  try {
    const content = await fsp.readFile(CREDENTIALS_PATH);
    const authClient = await authorize(SCOPES, TOKEN_PATH, JSON.parse(content));
    const range = 'Academic!A1:V';
    const { headers, rows } = await read(SPREADSHEET_ID, authClient, range);

    console.log(headers);
    console.log('----------------');

    // Print columns A and E, which correspond to indices 0 and 4.
    rows.map((row) => {
      console.log(`${row[0]}, ${row[4]}`);
    });
  } catch (e) {
    console.error(e);
  }
})();
