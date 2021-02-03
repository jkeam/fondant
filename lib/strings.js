/**
 * Convert string to camel case.
 *
 * @param {string} string The string to convert
 * @returns {string} Camel cased string
 */
function toCamelCase(string) {
  return string.replace(/\-/g, '')
    .replace(/\s+(.)/g, (match, group) => group.toUpperCase())
    .replace(/\s+/g, '');
}

module.exports = {
  toCamelCase
};
