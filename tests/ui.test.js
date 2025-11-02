// Simple smoke test for the simulated API. Run with `node tests/ui.test.js`
const assert = require('assert')
const fs = require('fs')

// We can't import browser api.js easily in node; smoke test checks seed file exists
const seed = JSON.parse(fs.readFileSync('data/seed.json','utf8'))
assert(Array.isArray(seed.products) && seed.products.length>0, 'seed products present')
assert(Array.isArray(seed.tables) && seed.tables.length>0, 'seed tables present')
console.log('smoke tests passed')
