const fs = require('fs');
const fsp = fs.promises;
const { authorize } = require('./lib/auth');
const { read } = require('./lib/sheet');
const { db, createDatabase, search, findByFieldName } = require('./lib/db');
const inquirer = require('inquirer');
const chalk = require('chalk');
const figlet = require('figlet');
const AsciiTable = require('ascii-table');

require('dotenv').config();
const SPREADSHEET_ID = process.env.SPREADSHEET_ID || '';
const RANGE = process.env.RANGE || '';
const SEARCH_FIELD = process.env.SEARCH_FIELD || '';
const CREDENTIALS_PATH = process.env.CREDENTIALS_PATH || 'credentials.json';
const TOKEN_PATH = process.env.TOKEN_PATH || 'token.json';
const JSON_PATH = process.env.JSON_PATH || 'database.json';
const APP_NAME = process.env.APP_NAME || 'Fondant';
const SEARCH_CONFIG = process.env.SEARCH_CONFIG || '';
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
     *
     *  @returns {Object[]} sheet Sheet data
     */
    const createDatastore = async () => {
      const content = await fsp.readFile(CREDENTIALS_PATH);
      const authClient = await authorize(SCOPES, TOKEN_PATH, JSON.parse(content));
      const sheets = await read(SPREADSHEET_ID, authClient, RANGE.split(',').map(i => i.trim()));
      await createDatabase(authClient, sheets, JSON_PATH);
      return sheets;
    };

    /**
     *  Find matching rows.
     *
     *  @param {string} term Search term
     *  @param {Object[]} sheet Sheet data
     *  @returns {Object[]} Return matching rows
     */
    const find = async (sheets, term) => search(sheets, SEARCH_FIELD, term);

    /**
     *  Find matching row.
     *
     *  @param {Object[]} sheet Sheet data
     *  @param {string} fieldName Search field
     *  @param {string} term Search term
     *  @returns {{headers: string[], row: string[]}} Return matching rows
     */
    const findByField = async (sheets, fieldName, term) => findByFieldName(sheets, fieldName, term);

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
     *  @returns {Object[]} Read and return json.
     */
    const readJson = async () => {
      try {
        await fsp.access(JSON_PATH, fs.constants.R_OK);
        return JSON.parse(await fsp.readFile(JSON_PATH));
      } catch (e) {
        return [];
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

    // main
    let sheets = await readJson()
    init();
    while(true) {
      const { term } = await askForTerm();

      // check for quit
      if (term === 'quit' || term === 'exit') {
        break;
      }

      // command
      if (term.includes('!')) {
        const termParts = term.split(' ');
        const command = termParts[0].replace('!', '');
        if (command === 'reload' || command === 'refresh') {
          sheets = await createDatastore();
        } else if (command === 'find') {
          const fieldName = termParts[1];
          const fieldValue = termParts[2];
          const { headers, row } = await findByField(sheets, fieldName, fieldValue);
          const table = new AsciiTable(`${fieldName}: ${fieldValue}`);
          for (let i = 0; i < headers.length; i++) {
            table.addRow(headers[i], row[i]);
          }
          console.log(table.toString());
          continue;
        } else {
          console.log('Command not understood');
          continue;
        }
      }

      // check for empty term
      if (!term.trim()) {
        continue;
      }

      const results = await find(sheets, term);
      if (!results.length) {
        console.log('No results found.');
        continue;
      }

      const table = new AsciiTable(term.toUpperCase());
      const headings = [];
      const rowPositions = [];
      if (SEARCH_CONFIG) {
        const items = SEARCH_CONFIG.split(',').map(i => i.trim());
        for (let item of items) {
          const valueName = item.split(':');
          headings.push(valueName[0]);
          rowPositions.push(parseInt(valueName[1], 10));
        }
      }
      if (headings.length) {
        table.setHeading(...headings);
      }
      for (result of results) {
        if (rowPositions.length) {
          table.addRow(...(rowPositions.map(r => result[r])));
        } else {
          table.addRow(...result);
        }
      }
      console.log(table.toString());
    }
  } catch (e) {
    console.error(e);
  }
})();
