/*global describe:true, it:true*/

'use strict'

var Seneca = require('seneca')
var shared = Seneca.test.store.shared
var SenecaCouchDBStore = require('..')

var si = Seneca()
si.use(SenecaCouchDBStore, {host: 'localhost',
                            port: 5984,
                            database: 'senecatest'})

si.__testcount = 0
var testcount = 0


describe('couchdb', function () {
  it('basic', function (done) {
    this.timeout(0)
    testcount++
    shared.basictest(si, done)
  })

  it('close', function (done) {
    this.timeout(0)
    shared.closetest(si, testcount, done)
  })
})
