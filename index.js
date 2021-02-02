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
const CREDENTIALS_PATH = process.env.CREDENTIALS_PATH || 'credentials.json';
const TOKEN_PATH = process.env.TOKEN_PATH || 'token.json';
const JSON_PATH = process.env.JSON_PATH || 'database.json';
const APP_NAME = process.env.APP_NAME || 'Fondant';
const SEARCH_CONFIG = process.env.SEARCH_CONFIG || '';
const SEARCH_INDEX_FIELDS = process.env.INDEXED_FIELDS || '';
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
     *  Destructively recreate database.
     *
     *  @returns {{sheets:Object[], searcher:Object} Sheet data and searcher
     */
    const createDatastore = async (searchResultHeadings) => {
      const content = await fsp.readFile(CREDENTIALS_PATH);
      const authClient = await authorize(SCOPES, TOKEN_PATH, JSON.parse(content));
      const sheets = await read(SPREADSHEET_ID, authClient, RANGE.split(',').map(i => i.trim()));
      await createDatabase(sheets, JSON_PATH);
      const searcher = createSearcher(searchResultHeadings, sheets);
      return { sheets, searcher };
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
     * @returns {{sheets:Object[], searcher:Object}} Read and return json.
     */
    const readJson = async (searchResultHeadings) => {
      try {
        await fsp.access(JSON_PATH, fs.constants.R_OK);
        const sheets = JSON.parse(await fsp.readFile(JSON_PATH));
        const searcher = createSearcher(searchResultHeadings, sheets);
        return { sheets, searcher };
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
     */
    const findCommand = async (sheets, fieldName, fieldValue) => {
      const result = await findByFieldName(sheets, fieldName, fieldValue);
      if (!result) {
        console.log(`Unable to find ${fieldName} with ${fieldValue}.`);
        return;
      }
      const { headers, row } = result;
      const table = new AsciiTable(`${fieldName}: ${fieldValue}`);
      for (let i = 0; i < headers.length; i++) {
        table.addRow(headers[i], row[i]);
      }
      console.log(table.toString());
    };

    /**
     * Create search metadata.
     *
     *  @param {string} searchConfig Parse input search config
     *  @param {string} indexFieldConfig Parse input field config
     *  @returns {{searchResultHeadings:string[], searchRowPositions:string[], searchIndexFields:string[]}} Search Metadata
     */
    const createSearchResultTableMetadata = (searchConfig, indexFieldConfig) => {
      const searchResultHeadings = [];
      const searchRowPositions = [];
      const searchIndexFields = [];
      if (searchConfig) {
        const items = searchConfig.split(',').map(i => i.trim());
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
          table.addRow(...result);
        }
      }
      console.log(table.toString());
      console.log(`Found ${results.length} matches.`);
    };

    /**
     * Create searcher -- for fast searching
     *
     * @param {string[]} searchResultHeadings Headings from the search results
     * @param {Object[]} sheets All the sheets to index
     * @returns {Object} Searcher object
     */
    const createSearcher = (searchResultHeadings, sheets) => {
      const formattedFields = searchResultHeadings.map(s => toCamelCase(s));
      const searcher = new MiniSearch({
        fields: formattedFields, // fields to index for full-text search
        storeFields: formattedFields // fields to return with search results
      });

      const allModels = [];
      for (let sheet of sheets) {
        for (let model of sheet.models) {
          allModels.push(model);
        }
      }
      searcher.addAll(allModels);
      return searcher;
    };

    // main
    const { searchResultHeadings, searchRowPositions, searchIndexFields } = createSearchResultTableMetadata(SEARCH_CONFIG, SEARCH_INDEX_FIELDS);
    let { sheets, searcher } = await readJson(searchIndexFields);
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
          const datastore = await createDatastore(searchIndexFields);
          sheets = datastore.sheets;
          searcher = datastore.searcher;
          continue;
        } else if (command === 'find') {
          await findCommand(sheets, termParts[1], termParts[2]);
          continue;
        } else {
          console.log('Command not understood');
          continue;
        }
      }

      if (searcher) {
        const results = searcher.search(term);
        printSearchResults(term, searchResultHeadings, searchRowPositions, results);
      } else {
        console.log('Unable to search, try running !reload again');
      }
    }
  } catch (e) {
    console.error(e);
  }
})();
