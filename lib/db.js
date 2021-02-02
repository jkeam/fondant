const fsp = require('fs').promises;

/**
 * Destructively recreate database and json path metadata.
 *
 * @param {string} sheets Spreadsheets read from google
 * @param {string} jsonPath Json path to create the json file
 * @returns {Object} sheets Raw data read from the sheet
 */
async function createDatabase(sheets, jsonPath) {
  await fsp.writeFile(jsonPath, JSON.stringify(sheets));
  return sheets;
}

/**
 * Find the header index in a given sheet.
 *
 * @param {string} searchField The search field to match in the headers
 * @param {string[]} headers The list of header fields
 * @returns {number} The matching index in the headers
 */
function findHeaderIndex(searchField, headers) {
  if (!searchField) {
    return -1;
  }

  const lowerSearchField = searchField.toLowerCase();
  for (let j = 0; j < headers.length; j++) {
    if (headers[j].toLowerCase() === lowerSearchField) {
      return j;
    }
  }
  return -1;
}

/**
 *  Search for term by field.
 *
 *  @param {Object[]} sheets Sheets to search through
 *  @param {string} searchField Field to search against, case insensitive
 *  @param {string} term Term to search for, case insensitive
 *  @returns {Object[]} search results
 */
function search(sheets, searchField, term) {
  const results = [];
  if (!sheets || !sheets.length || !term || !searchField) {
    return results;
  }

  const lowerTerm = term.toLowerCase();
  for (let sheet of sheets) {
    const { headers, rows } = sheet;
    const headerIndex = findHeaderIndex(searchField, headers);
    if (headerIndex === -1) {
      continue;
    }

    for (let row of rows) {
      if ((row[headerIndex] || '').toLowerCase().includes(lowerTerm)) {
        results.push(row);
      }
    }
  }
  return results;
}

/**
 * Finds matching row by the field value, will only return one.
 *
 * @param {string} fieldName Field name to search by
 * @param {string} fieldValue Value to match
 * @returns {{headers:string[], row:string[]}} Single matching object
 */
function findByFieldName(sheets, fieldName, fieldValue) {
  if (!sheets || !sheets.length || !fieldName || !fieldValue) {
    return null;
  }

  const lowerFieldValue = fieldValue.toLowerCase();
  for (let sheet of sheets) {
    const { headers, rows } = sheet;
    const headerIndex = findHeaderIndex(fieldName, headers);
    if (headerIndex === -1) {
      continue;
    }

    for (let row of rows) {
      if ((row[headerIndex] || '').toLowerCase() === lowerFieldValue) {
        return { headers, row };
      }
    }
  }
  return null;
}

module.exports = {
  createDatabase,
  search,
  findByFieldName
};
