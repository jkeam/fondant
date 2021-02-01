function toCamelCase(string) {
  return string.replace(/\-/g, '')
    .replace(/\s+(.)/g, (match, group) => group.toUpperCase())
    .replace(/\s+/g, '');
}

module.exports = {
  toCamelCase
};
