# Fondant
A Google Sheet Application

## Prerequisites

1. Node v15+

2. Create `.env` file with the following

```
SPREADSHEET_ID='XYZ_34asfaDFa'
RANGE='Sheet1!A1:V, Sheet2!A1:E'
```

## Setup

1. Install dependencies

```
yarn
```

2.  Install sqlite3 most likely by building from source

```
npm_config_python=/usr/bin/python2 npm_config_build_from_source=true yarn add sqlite3
```

3. Start

```
yarn start
```
