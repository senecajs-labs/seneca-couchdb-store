/* Copyright (c) 2012 Marius Ursache */

var seneca = require('seneca');
var shared = require('seneca/test/store/shared');

var config = {
  log:'print'
};

var si = seneca(config);

var senecaCouchDBStore = require('seneca-couchdb');
var senecaCouchDBStoreOpts = {
    host:'172.16.234.129',
    port:5984,
    database:'testdatabase'};
si.use(senecaCouchDBStore, senecaCouchDBStoreOpts);

si.__testcount = 0;
var testcount = 0;

module.exports = {
  basictest: (testcount++, shared.basictest(si)),
  extratest: (testcount++, extratest(si)),
  closetest: shared.closetest(si,testcount)
};

function extratest(si) {
  console.log('EXTRA')
  si.__testcount++
}
