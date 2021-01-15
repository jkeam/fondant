const { google } = require('googleapis');

async function read(spreadsheetId, auth, range) {
  const { data } = await readSheet(spreadsheetId, auth, range);

  const rows = data.values;
  if (!rows.length) {
    return { headers: [], rows: [] };
  }

  const headers = parseHeader(rows.shift());
  return { headers, rows };
}

/*
 * Read sheet
 * @param {google.auth.OAuth2} auth The authenticated Google OAuth client.
 * @returns {Promise} Resolves to response with the data.
 */
async function readSheet(spreadsheetId, auth, range) {
  const sheets = google.sheets({version: 'v4', auth});
  return new Promise((resolve, reject) => {
    sheets.spreadsheets.values.get({
      spreadsheetId,
      range
    }, (err, res) => {
      if (err) {
        return reject(err);
      }
      resolve(res);
    });
  });
}

function parseHeader(headerRow) {
  return (headerRow || []).map(header => header.replaceAll(' ', '').replaceAll('-', ''));
}

module.exports = {
  read
};
