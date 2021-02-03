const fs = require('fs');
const fsp = fs.promises;
const { authorize } = require('./lib/auth');
const { read } = require('./lib/sheet');
const { createDatabase, findByFieldName } = require('./lib/db');
const { toCamelCase } = require('./lib/strings');
const inquirer = require('inquirer');
const chalk = require('chalk');
const figlet = require('figlet');
const AsciiTable = require('ascii-table');
const MiniSearch = require('minisearch');

require('dotenv').config();
const SPREADSHEET_ID = process.env.SPREADSHEET_ID || '';
const RANGE = process.env.RANGE || '';
const SEARCH_INDEX_FIELDS = process.env.INDEXED_FIELDS || '';
const CREDENTIALS_PATH = process.env.CREDENTIALS_PATH || 'credentials.json';
const TOKEN_PATH = process.env.TOKEN_PATH || 'token.json';
const JSON_PATH = process.env.JSON_PATH || 'database.json';
const APP_NAME = process.env.APP_NAME || 'Fondant';
const RESULT_HEADERS = process.env.RESULT_HEADERS || '';
const ID_FIELD = process.env.ID_FIELD || 'id';
const scope = process.env.READ_ONLY_SCOPE || 'https://www.googleapis.com/auth/spreadsheets.readonly';
const SCOPES = [scope];   // If modifying these scopes, delete token.json.

(async () => {
  try {

    // validate
    if (!SPREADSHEET_ID) {
      console.error('Missing SPREADSHEET_ID env var');
      return;
    }
    if (!RANGE) {
      console.error('Missing RANGE env var');
      return;
    }
    if (!SEARCH_INDEX_FIELDS) {
      console.error('Missing SEARCH_INDEX_FIELDS env var');
      return;
    }

    /**
     * Destructively recreate database.
     *
     * @param {string[]} searchResultHeadings List of search result headings
     * @param {string} idField The id field for the model
     * @returns {{sheets:Object[], searcher:Object, rowById:Object} Sheet data and searcher
     */
    const createDatastore = async (searchResultHeadings, idField) => {
      const content = await fsp.readFile(CREDENTIALS_PATH);
      const authClient = await authorize(SCOPES, TOKEN_PATH, JSON.parse(content));
      const sheets = await read(SPREADSHEET_ID, idField, authClient, RANGE.split(',').map(i => i.trim()));
      await createDatabase(sheets, JSON_PATH);
      const { searcher, rowById } = createSearcher(searchResultHeadings, idField, sheets);
      return { sheets, searcher, rowById };
    };

    /**
     *  Print out app name.
     */
    const init = () => {
      console.log(
        chalk.green(
          figlet.textSync(APP_NAME, {
            horizontalLayout: 'full',
          })
        )
      );
    };

    /**
     *  Read JSON.
     *
     * @param {string[]} searchResultHeadings Headings to use in the indexing
     * @param {string} idField The id field of the model
     * @returns {{sheets:Object[], searcher:Object, rowById:Object}} Read and return json.
     */
    const readJson = async (searchResultHeadings, idField) => {
      try {
        await fsp.access(JSON_PATH, fs.constants.R_OK);
        const sheets = JSON.parse(await fsp.readFile(JSON_PATH));
        const { searcher, rowById } = createSearcher(searchResultHeadings, idField, sheets);
        return { sheets, searcher, rowById };
      } catch (e) {
        console.log(e);
        return { sheets: [], searcher: null };
      }
    };

    /**
     *  Ask user for search term.
     *
     *  @returns {Promise<{term:string}>} Capture use search term
     */
    const askForTerm = async () => {
      const questions = [{
        name: 'term',
        type: 'input',
        message: 'Enter in search term ("exit" to stop):',
      }]
      return inquirer.prompt(questions);
    };

    /**
     *  Perform find command.
     *
     *  @param {Object[]} sheets Sheets of data
     *  @param {string} fieldName Field name to find by
     *  @param {string} fieldValue Field value to find
     *  @param {Object} rowById Row keyed by id
     */
    const findCommand = async (idField, sheets, fieldName, fieldValue, rowById) => {
      let headers, row, result;
      if (fieldName === 'id' || fieldName === idField) {
        // fast lookup
        result = rowById[fieldValue];
        headers = Object.keys(result);
        row = Object.values(result);
      } else {
        // slow scan of every object
        result = await findByFieldName(sheets, fieldName, fieldValue);
        headers = result.headers;
        row = result.row;
      }

      if (!result) {
        console.log(`Unable to find ${fieldName} with ${fieldValue}.`);
        return;
      }

      const table = new AsciiTable(`${fieldName}: ${fieldValue}`);
      for (let i = 0; i < headers.length; i++) {
        table.addRow(headers[i], row[i]);
      }
      console.log(table.toString());
    };

    /**
     * Create search metadata.
     *
     *  @param {string} resultHeaders Parse input search config
     *  @param {string} indexFieldConfig Parse input field config
     *  @returns {{searchResultHeadings:string[], searchRowPositions:string[], searchIndexFields:string[]}} Search Metadata
     */
    const createSearchResultTableMetadata = (resultHeaders, indexFieldConfig) => {
      const searchResultHeadings = [];
      const searchRowPositions = [];
      const searchIndexFields = [];
      if (resultHeaders) {
        const items = resultHeaders.split(',').map(i => i.trim());
        for (let item of items) {
          const valueName = item.split(':');
          searchResultHeadings.push(valueName[0]);
          searchRowPositions.push(valueName[1]);
        }
      }
      if (indexFieldConfig) {
        const items = indexFieldConfig.split(',').map(i => i.trim());
        for (let item of items) {
          searchIndexFields.push(item);
        }
      }
      return { searchResultHeadings, searchRowPositions, searchIndexFields };
    };

    /**
     *  Print out search results
     *
     *  @param {string} term Search term
     *  @param {string[]} searchResultHeadings Search result headers
     *  @param {string[]} searchRowPositions Search result positions to get data
     *  @param {Object[]} results Search results
     */
    const printSearchResults = (term, searchResultHeadings, searchRowPositions, results) => {
      const table = new AsciiTable(term.toUpperCase());
      if (searchResultHeadings.length) {
        table.setHeading(...searchResultHeadings);
      }
      for (result of results) {
        if (searchRowPositions.length) {
          table.addRow(...(searchRowPositions.map(r => result[r].slice(0, 128))));
        } else {
          const values = Object.values(result).filter(r => typeof r === 'string');
          table.addRow(...values);
        }
      }
      console.log(table.toString());
      console.log(`Found ${results.length} matches.`);
    };

    /**
     * Create searcher -- for fast searching
     *
     * @param {string[]} searchResultHeadings Headings from the search results
     * @param {string} idField The id field
     * @param {Object[]} sheets All the sheets to index
     * @returns {{searcher:Object, rowById:Object} Searcher object
     */
    const createSearcher = (searchResultHeadings, idField, sheets) => {
      const formattedFields = searchResultHeadings.map(s => toCamelCase(s));
      const searcher = new MiniSearch({
        idField,
        fields: formattedFields, // fields to index for full-text search
        storeFields: formattedFields, // fields to return with search results
        searchOptions: {
          prefix: true,
          fuzzy: 0.2
        }
      });

      const allModels = [];
      const rowById = {};
      for (let sheet of sheets) {
        for (let model of sheet.models) {
          allModels.push(model);
          rowById[model[idField]] = model;
        }
      }

      searcher.addAll(allModels);
      return { searcher, rowById };
    };

    // main
    const { searchResultHeadings, searchRowPositions, searchIndexFields } = createSearchResultTableMetadata(RESULT_HEADERS, SEARCH_INDEX_FIELDS);
    let { sheets, searcher, rowById } = await readJson(searchIndexFields, ID_FIELD);
    init();
    while(true) {
      const { term } = await askForTerm();

      // check for empty term
      if (!term.trim()) {
        continue;
      }

      // check for quit
      if (term === 'quit' || term === 'exit') {
        break;
      }

      // command
      if (term.includes('!')) {
        const termParts = term.split(' ');
        const command = termParts[0].replace('!', '');
        if (command === 'reload' || command === 'refresh') {
          const datastore = await createDatastore(searchIndexFields, ID_FIELD);
          sheets = datastore.sheets;
          searcher = datastore.searcher;
          rowById = datastore.rowById;
          continue;
        } else if (command === 'find') {
          if (!termParts[1] || !termParts[2]) {
            console.log('!find {fieldName} {searchTerm}');
            continue;
          }
          await findCommand(ID_FIELD.toLowerCase(), sheets, termParts[1].toLowerCase(), termParts[2], rowById);
          continue;
        } else {
          console.log('Command not understood');
          continue;
        }
      }

      if (searcher) {
        const results = searcher.search(term);
        if (!results || !results.length) {
          console.log('No results found.');
        } else {
          printSearchResults(term, searchResultHeadings, searchRowPositions, results);
        }
      } else {
        console.log('Unable to search, try running !reload again');
      }
    }
  } catch (e) {
    console.error(e);
  }
})();
