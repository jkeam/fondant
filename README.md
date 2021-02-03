# Fondant
A Google Sheet Application

## Prerequisites

1. Node v15+

2. Create `.env` file with the following

```
SPREADSHEET_ID='1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms'
RANGE='Class Data!A1:F'
JSON_PATH='database.json'
APP_NAME='AwesomeApp'
INDEXED_FIELDS='StudentName,Gender,ClassLevel,HomeState,Major,ExtracurricularActivity'
RESULT_HEADERS='Student Name:StudentName,Gender:Gender,Class Level:ClassLevel,Home State:HomeState,Major:Major,Extracurricular Activity:ExtracurricularActivity'
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
