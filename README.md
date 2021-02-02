# Fondant
A Google Sheet Application

## Prerequisites

1. Node v15+

2. Create `.env` file with the following

```
SPREADSHEET_ID='XYZ_34asfaDFa'
RANGE='Sheet1!A1:V, Sheet2!A1:E'
JSON_PATH='database.json'
SEARCH_FIELD='default_search_field'
APP_NAME='AwesomeApp'
SEARCH_CONFIG='ID:0,Description:1'
```

## Setup

1. Install dependencies

```
yarn
```

2.  Test

```
yarn test
```

3. Start

```
yarn start
```

## Notes

If you get weird API endpoint errors with google sheets, try deleting the `token.json` and rerun the app and `!reload` to resync with the sheet.  Chances are your token is expired.
