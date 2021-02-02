const { google } = require('googleapis');
const { toCamelCase } = require('./strings');
const { v4 } = require('uuid');

/**
 * Read sheet and return object that has both headers and rows.
 * 
 * @param {string} spreadsheetId The spreadsheet id
 * @param {google.auth.OAuth2} auth The authenticated Google OAuth client.
 * @param {string[]} ranges The ranges of cells to read.
 * @returns {Promise} Resolves to responses with the headers and rows.
 */
async function read(spreadsheetId, auth, ranges) {
  const responses = [];

  for (const range of ranges) {
    const { data } = await readSheet(spreadsheetId, auth, range);
    const name = toCamelCase(range.split('!')[0]);

    const rows = data.values;
    if (!rows.length) {
      return { headers: [], rows: [], originalHeaders: [], models: [], name };
    }

    const originalHeaders = rows.shift();
    const headers = formatHeader(originalHeaders);
    const models = createModels(headers, rows);
    responses.push({ headers, rows, originalHeaders, models, name });
  }

  return responses;
}

/**
 * Read sheet.
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
 * Format the header into camel case.  Strip spaces.
 * 
 * @param {string[]} headerRow The row of headers to format
 * @return {string[]} Formatted header names
 */
function formatHeader(headerRow) {
  return (headerRow || []).map(header => toCamelCase(header).replace('#', 'Number'));
}

/**
 * Create models.
 *
 * @param {string[]} headers The formatted header that will be used as the attribute name
 * @param {string[]} rows The row data to turn into models
 * @return {Object[]} List of models/json objects
 */
function createModels(headers, rows) {
  const models = [];
  for (const row of rows) {
    const model = {id: null};
    models.push(model);
    for (let i = 0; i < headers.length; i++) {
      model[headers[i]] = (row[i] || '').toString();
    }
    if (!model.id) {
      model.id = v4();
    }
  }
  return models;
}

module.exports = {
  read
};
