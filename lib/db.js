const fsp = require('fs').promises;
const { Sequelize, DataTypes } = require('sequelize');

//const sequelize = new Sequelize('sqlite::memory:') // Example for sqlite
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: './database.sqlite'
});

/**
 * Create db collection
 *
 * @param {string} name Name of the collection
 * @param {string[]} headers Header/Column names
 * @returns Sequelize Model
 */
async function createCollection(name, headers, syncOption = { alter: true }) {
  const options = {};
  const schema = {};
  schema.id = {
    type: DataTypes.UUID,
    defaultValue: Sequelize.UUIDV4,
    primaryKey: true
  };
  for (const header of headers) {
    schema[header] = {
      type: DataTypes.STRING
    };
  }
  const model = sequelize.define(name, schema, options);
  if (syncOption) {
    await model.sync(syncOption);
  } else {
    await model.sync();
  }
  return model;
}

/**
 * Query for terms like given.
 * @Deprecated, unused
 *
 * @param {Sequelize[]} models Models/Tables to query
 * @param {string} searchField The field to search against
 * @param {string} term The search term
 * @returns {Object[]} List of models
 */
async function queryLike(models, searchField, term) {
  const results = [];
  if (!models || !models.length || !term) {
    return results;
  }

  for (let model of models) {
    const curResults = model.findAll({where: createLikeClause(searchField, term)});
    curResults.forEach(cur => results.push(cur));
  }
  return results;
}

/**
 * Create like clause for searching.
 *
 * @param {string} columnName Column name to search against
 * @param {string} term Term to like search against
 * @returns {SequelizeQuery} Where clause
 */
function createLikeClause(columnName, term) {
  const likeQuery = {
    $like: `%${term}%`
  };
  return Sequelize.where(Sequelize.fn('lower', Sequelize.col(columnName)), likeQuery);
}

/**
 * Fetch all tables.
 * @Deprecated, unused
 *
 * @returns {Promise(SequelizeSchema[])}
 */
async function fetchAllTableNames() {
  return new Promise((resolve, reject) => (
    sequelize.getQueryInterface().showAllSchemas()
      .then(tableObj => resolve(tableObj))
      .catch(err => reject(err))
  ));
}

/**
 * Destructively recreate database and json path metadata.
 *
 * @param {google.auth.OAuth2} auth The authenticated Google OAuth client.
 * @param {string} sheets Spreadsheets read from google
 * @param {string} jsonPath Json path to create the json file
 * @returns {Object} sheets Raw data read from the sheet
 */
async function createDatabase(authClient, sheets, jsonPath) {
  await sequelize.drop();
  for (const sheet of sheets) {
    const { headers, originalHeaders, rows, models, name } = sheet;
    const collection = await createCollection(name, headers, { force: true });
    for (const model of models) {
      await collection.create(model);
    }
  }
  await fsp.writeFile(jsonPath, JSON.stringify(sheets));
  return sheets;
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
  const lowerSearchField = searchField.toLowerCase();
  for (let sheet of sheets) {
    const { headers, rows } = sheet;
    let headerIndex = -1;
    for (let j = 0; j < headers.length; j++) {
      if (headers[j].toLowerCase() === lowerSearchField) {
        headerIndex = j;
        break;
      }
    }
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

module.exports = {
  db: sequelize,
  createDatabase,
  search
};
