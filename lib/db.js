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

module.exports = {
  db: sequelize,
  createCollection
};
