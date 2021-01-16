const { Sequelize } = require('sequelize');

//const sequelize = new Sequelize('sqlite::memory:') // Example for sqlite
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: './database.sqlite'
});

module.exports = {
  db: sequelize
};
