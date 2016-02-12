'use strict'
var Assert = require('assert')
var _ = require('lodash')
var Uuid = require('uuid')
var Couchdb = require('felix-couchdb')

var NAME = 'couchdb-store'
var MIN_WAIT = 16
var MAX_WAIT = 65336
var OBJECT_TYPE = 'o'
var ARRAY_TYPE = 'a'
var DATE_TYPE = 'd'
var SENECA_TYPE_COLUMN = 'seneca'
var SENECA_COLLECTION = 'seneca_collection'


module.exports = function (opts) {
  var seneca = this
  var desc
  var dbinst = null
  var spec = null
  var connection = null

  opts.minwait = opts.minwait || MIN_WAIT
  opts.maxwait = opts.maxwait || MAX_WAIT


  /**
   * check and report error conditions seneca.fail will execute the callback
   * in the case of an error. Optionally attempt reconnect to the store depending
   * on error condition
   */
  function error (args, err, cb) {
    if (err) {
      seneca.log.debug('error: ' + err)
      seneca.fail({code: 'entity/error', store: NAME}, cb)
    }
    return err
  }


  /**
   * configure the store - create a new store specific connection object
   *
   * params:
   * spec - store specific configuration
   * cb - callback
   */
  function configure (specification, cb) {
    Assert(specification)
    Assert(cb)

    spec = specification

    var conf = 'string' === typeof (spec) ? null : spec
    if (!conf) {
      conf = {}
      var urlM = /^couchdb:\/\/((.*?)@)?(.*?)(:?(\d+))$/.exec(spec)
      conf.host = urlM[3]
      conf.password = urlM[2]
      conf.port = urlM[5]
      conf.port = conf.port ? parseInt(conf.port, 10) : null
    }

    // TODO: add auth support
    connection = Couchdb.createClient(conf.port, conf.host)
    dbinst = connection.db(conf.database)
    dbinst.info(function (err, info) {
      if (err !== null && err.error === 'not_found') {
        dbinst.create(function (err, result) {
          if (!error(null, err, cb)) {
            seneca.log({tag$: 'init'}, 'database ' + conf.database + ' created.')
            cb(null, store)
          }
        })
      }
      else {
        cb(null, store)
      }
    })
  }


  /**
   * the simple db store interface returned to seneca
   */
  var store = {
    name: NAME,


    /**
     * close the connection
     *
     * params
     * cmd - optional close command parameters
     * cb - callback
     */
    close: function (cmd, cb) {
      Assert(cb)
      if (dbinst) {
        dbinst = null
      }
      cb(null)
    },


    /**
     * save the data as specified in the entitiy block on the arguments object
     *
     * params
     * args - of the form { ent: { id: , ..entitiy data..} }
     * cb - callback
     */
    save: function (args, cb) {
      Assert(args)
      Assert(cb)
      Assert(args.ent)

      var ent = args.ent
      var table = tablename(ent)
      var mapFunction = "function(doc){if(doc.seneca_collection === '" + table + "'){ emit(null, doc); }}"
      var viewDescription = {}
      viewDescription[table] = {
        map: mapFunction
      }

      if (!ent.id) {
        ent.id = Uuid()
      }

      var entp = makeentp(ent)
      dbinst.saveDoc(ent.id, entp, function (err, result) {
        if (!error(args, err, cb)) {
          seneca.log(args.tag$, 'save', result)
          dbinst.saveDesign('seneca_collection_' + table, {
            views: viewDescription
          })
          cb(null, ent)
        }
      })
    },


    /**
     * load first matching item based on id
     * params
     * args - of the form { ent: { id: , ..entitiy data..} }
     * cb - callback
     */
    load: function (args, cb) {
      Assert(args)
      Assert(cb)
      Assert(args.qent)
      Assert(args.q)

      var q = _.clone(args.q)
      var qent = args.qent

      q.limit$ = 1
      dbinst.getDoc(qent.id, function (err, result) {
        if (!error(args, err, cb)) {
          var ent = makeent(qent, result)
          seneca.log(args.tag$, 'load', ent)
          cb(null, ent)
        }
      })
    },


    /**
     * return a list of object based on the supplied query, if no query is supplied
     * then 'select * from ...'
     *
     * Notes: trivial implementation and unlikely to perform well due to list copy
     *        also only takes the first page of results from simple DB should in fact
     *        follow paging model
     *
     * params
     * args - of the form { ent: { id: , ..entitiy data..} }
     * cb - callback
     * a=1, b=2 simple
     * next paging is optional in simpledb
     * limit$ ->
     * use native$
     */
    list: function (args, cb) {
      Assert(args)
      Assert(cb)
      Assert(args.qent)
      Assert(args.q)

      var qent = args.qent
      var q = args.q
      var table = tablename(qent)
      var viewDesign = 'seneca_collection_' + table

      dbinst.view(viewDesign, table, {}, function (err, result) {
        if (!error(args, err, cb)) {
          var list = []
          _.each(result.rows, function (value) {
            var ent = makeent(qent, value.value)
            list.push(ent)
          })

          if (!_.isEmpty(q)) {
            list = _.filter(list, function (elem) {
              var match = true
              _.each(q, function (value, key) {
                var computed = (elem[key] === value)
                match = match && computed
              })
              return match
            })
          }
          cb(null, list)
        }
      })
    },


    /**
     * delete an item - fix this
     *
     * params
     * args - of the form { ent: { id: , ..entitiy data..} }
     * cb - callback
     * { 'all$': true }
     */
    remove: function (args, cb) {
      Assert(args)
      Assert(cb)
      Assert(args.qent)
      Assert(args.q)

      var qent = args.qent
      var q = args.q
      var table = tablename(qent)
      var viewDesign = 'seneca_collection_' + table

      if (q.all$) {
        dbinst.view(viewDesign, table, {}, function (err, result) {
          if (!error(args, err, cb)) {
            var list = []
            _.each(result.rows, function (value) {
              var ent = makeent(qent, value.value)
              list.push(ent)
            })

            _.each(list, function (value) {
              var id = value._id
              var rev = value._rev

              dbinst.removeDoc(id, rev, function (err, result) {
                error(args, err, cb)
              })
            })
            cb(null, result)
          }
        })
      }
      else if (!_.isEmpty(q)) {
        store.list(args, function (err, elements) {
          if (err) {
            return cb(err)
          }
          _.each(elements, function (value) {
            var id = value._id
            var rev = value._rev

            dbinst.removeDoc(id, rev, function (err, result) {
              if (err) {
                return cb(err)
              }
              cb(null, result)
            })
          })
        })
      }
    },


    /**
     * return the underlying native connection object
     */
    native: function (args, cb) {
      Assert(args)
      Assert(cb)
      Assert(args.ent)


      // provide access to the underlying driver
      // cb(null, db);
    }
  }


  /**
   * initialization
   */
  var meta = seneca.store.init(seneca, opts, store)
  desc = meta.desc
  seneca.add({init: store.name, tag: meta.tag}, function (args, done) {
    configure(opts, function (err) {
      if (err) {
        return seneca.fail({code: 'entity/configure', store: store.name, error: err, desc: desc}, done)
      }
      else done()
    })
  })
  return { name: store.name, tag: meta.tag }
}


var makeentp = function (ent) {
  var entp = {}
  var fields = ent.fields$()
  var type = {}

  fields.forEach(function (field) {
    // entp[field] = ent[field];
    if (_.isDate(ent[field])) {
      type[field] = DATE_TYPE
    }
    else if (_.isArray(ent[field])) {
      type[field] = ARRAY_TYPE
    }
    else if (_.isObject(ent[field])) {
      type[field] = OBJECT_TYPE
    }

    if (!_.isDate(ent[field]) && _.isObject(ent[field])) {
      entp[field] = JSON.stringify(ent[field])
    }
    else {
      entp[field] = ent[field]
    }
  })

  if (!_.isEmpty(type)) {
    entp[SENECA_TYPE_COLUMN] = JSON.stringify(type)
  }

  entp[SENECA_COLLECTION] = tablename(ent)

  return entp
}


var makeent = function (ent, row) {
  var entp = {}
  var fields = _.keys(row)
  var senecatype = {}

  if (!_.isUndefined(row[SENECA_TYPE_COLUMN]) && !_.isNull(row[SENECA_TYPE_COLUMN])) {
    senecatype = JSON.parse(row[SENECA_TYPE_COLUMN])
  }

  if (!_.isUndefined(ent) && !_.isUndefined(row)) {
    fields.forEach(function (field) {
      if (SENECA_TYPE_COLUMN !== field) {
        if (_.isUndefined(senecatype[field])) {
          entp[field] = row[field]
        }
        else if (senecatype[field] === OBJECT_TYPE) {
          entp[field] = JSON.parse(row[field])
        }
        else if (senecatype[field] === ARRAY_TYPE) {
          entp[field] = JSON.parse(row[field])
        }
        else if (senecatype[field] === DATE_TYPE) {
          entp[field] = new Date(row[field])
        }
      }
    })
  }

  entp._id = row._id
  entp._rev = row._rev
  entp[SENECA_COLLECTION] = tablename(ent)
  return ent.make$(entp)
}


var tablename = function (entity) {
  var canon = entity.canon$({object: true})
  return (canon.base ? canon.base + '_' : '') + canon.name
}
