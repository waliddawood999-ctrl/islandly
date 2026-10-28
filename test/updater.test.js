const assert = require('assert');
const { cmp, gitBlobSha } = require('../src/main/util');

// `printf 'hello\n' | git hash-object --stdin`
assert.strictEqual(gitBlobSha(Buffer.from('hello\n')), 'ce013625030ba8dba906f756967f9e9ca394464a');
assert.strictEqual(gitBlobSha(Buffer.alloc(0)), 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391'); // the empty blob

assert(cmp('0.2.1', '0.2.0') > 0);
assert(cmp('0.10.0', '0.9.9') > 0);
assert(cmp('1.0.0', '1.0.0') === 0);
assert(cmp('0.2.0', '0.3.0') < 0);
console.log('updater helpers ok');
