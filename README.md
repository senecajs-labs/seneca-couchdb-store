Seneca-CouchDB is a CouchDB storage driver for [Seneca] MVP toolkit

Usage:

    var seneca              = require('seneca');
    var senecaCouchDBStore  = require('seneca-couchdb');

    var senecaConfig = {}
    var senecaCouchDBStoreOpts = {
        host: 'localhost',
        port: 12000
    };

    ...

    var si = seneca(senecaConfig);
    si.use(senecaCouchDBStore, senecaCouchDBStoreOpts);
    si.ready( function(){
        var product = si.make('product');
        ...
    });
    ...

[Seneca]: http://senecajs.org/
