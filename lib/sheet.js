const { google } = require('googleapis');

/**
 * Read sheet and return object that has both headers and rows.
 * 
 * @param {string} spreadsheetId The spreadsheet id
 * @param {google.auth.OAuth2} auth The authenticated Google OAuth client.
 * @param {string} range The range of cells to read.
 * @returns {Promise} Resolves to response with the headers and rows.
 */
async function read(spreadsheetId, auth, range) {
  const { data } = await readSheet(spreadsheetId, auth, range);

  const rows = data.values;
  if (!rows.length) {
    return { headers: [], rows: [] };
  }

  const originalHeaders = rows.shift();
  const headers = formatHeader(originalHeaders);
  return { headers, rows, originalHeaders };
}

/**
 * Read sheet
 * 
 * @param {string} spreadsheetId The spreadsheet id
 * @param {google.auth.OAuth2} auth The authenticated Google OAuth client.
 * @param {string} range The range of cells to read.
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

/**
 * Format the header into camel case.
 * 
 * @param {string[]} headerRow The row of headers to format
 */
function formatHeader(headerRow) {
  return (headerRow || []).map(header => header.replaceAll(' ', '').replaceAll('-', ''));
}

module.exports = {
  read
};
