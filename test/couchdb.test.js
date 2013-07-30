/*jslint node: true */
/*global describe:true, it:true*/
/* Copyright (c) 2012 Marius Ursache */

"use strict";

var seneca = require('seneca');
var shared = seneca.test.store.shared;
var senecaCouchDBStore = require('..');

var si = seneca();
si.use(senecaCouchDBStore, {host:'localhost',
                            port:5984,
                            database:'senecatest'});

si.__testcount = 0;
var testcount = 0;


describe('couchdb', function(){
  it('basic', function(done){
    this.timeout(0);
    testcount++;
    shared.basictest(si, done);
  });

  it('close', function(done){
    this.timeout(0);
    shared.closetest(si, testcount, done);
  });
});

