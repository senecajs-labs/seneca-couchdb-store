![SenecaLogo][]

# seneca-couchdb-store

[![npm version][npm-badge]][npm-url]
[![Dependency Status][david-badge]][david-url]
[![Gitter chat][gitter-badge]][gitter-url]

Seneca-CouchDB is a CouchDB storage driver for [Seneca] MVP toolkit

## Using seneca-couchdb-store:

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

## Install

```sh
npm install seneca-couchdb-store
```

## Test

To run tests, simply use npm:

```sh
npm run test
```

## Contributing

The [Senecajs org][] encourage open participation. If you feel you can help in any way, be it with documentation, examples, extra testing, or new features please get in touch.

## License

Copyright Marius Ursache and other contributors 2016, Licensed under [MIT][].

[Seneca]: http://senecajs.org/
[SenecaLogo]: https://camo.githubusercontent.com/4a0178ff2abf26f9214d4d98bc23eec356ced357/687474703a2f2f73656e6563616a732e6f72672f66696c65732f6173736574732f73656e6563612d6c6f676f2e706e67
[Senecajs org]: https://github.com/senecajs/
[MIT]: ./LICENSE.txt
[npm-badge]: https://badge.fury.io/js/seneca-couchdb-store.svg
[npm-url]: https://badge.fury.io/js/seneca-couchdb-store
[david-badge]: https://david-dm.org/senecajs-labs/seneca-couchdb-store.svg
[david-url]: https://david-dm.org/senecajs-labs/seneca-couchdb-store
[gitter-badge]: https://badges.gitter.im/senecajs/seneca.png
[gitter-url]: https://gitter.im/senecajs/seneca
