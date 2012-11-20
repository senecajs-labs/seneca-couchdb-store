/* Copyright (c) 2012 Marius Ursache */

var common  = require('seneca/lib/common');
var Store   = require('seneca').Store;
var couchdb = require('felix-couchdb');

var eyes    = common.eyes; // Used for development only
var _       = common._;
var uuid    = common.uuid;

var MIN_WAIT = 16;
var MAX_WAIT = 65336;

var OBJECT_TYPE = 'o';
var ARRAY_TYPE  = 'a';
var DATE_TYPE   = 'd';
var SENECA_TYPE_COLUMN = 'seneca';
var SENECA_COLLECTION = 'seneca_collection';

function CouchDBStore() {
  var self   = new Store();
  var parent = self.parent();

  var inid   = common.idgen(12);
  var seneca;
  var connection;
  var dbinst;

  globalObjectMap = {};

  self.name  = 'couchdb-store';

  /** create or update an entity */

  self.save$ = function(args, cb){
    // entity to save
    var ent   = args.ent;
    var q     = args.q;
    var table = tablename(ent);
    var mapFunction = "function(doc){if(doc.seneca_collection === '"+table+"'){ emit(null, doc); }}";
    var viewDescription = {};
    viewDescription[table] = {
      map: mapFunction
    };

    if( !ent.id ) {
      ent.id = uuid();
    }

    var entp = makeentp(ent);
    self.dbinst.saveDoc(ent.id, entp, function(err, result) {
      if(err){
        return seneca.fail({code:'save', tag:args.tag$, store:self.name, query:q, error:err}, cb);
      } else {
        seneca.log(args.tag$,'save', result);
        self.dbinst.saveDesign('seneca_collection_'+table, {
          views:viewDescription
        });
        cb(null, ent);
      }
    });
  };

  self.saveCounchDB = function(args, cb){
    var ent  = args.ent;
    var q    = args.q;
    var entp = makeentp(ent);

    self.dbinst.saveDoc(ent.id, entp, function(err, result) {
      if(err){
        return seneca.fail({code:'save', tag:args.tag$,
          store:self.name, query:q, error:err}, cb);
      } else {
        seneca.log(args.tag$,'save', result);
        cb(null, ent);
      }
    });
  };

  /** load the first matching entity */
  self.load$ = function(args, cb){
    var q    = _.clone(args.q);
    var qent = args.qent;

    q.limit$ = 1;

    self.dbinst.getDoc(qent.id, function(err, result) {
      if(err){
        seneca.fail({code:'load',tag:args.tag$,store:self.name,query:query,error:err}, cb);
      } else {
        var ent = makeent(qent, result);
        seneca.log(args.tag$, 'load', ent);
        //eyes.inspect(result, "Loaded: ");
        cb(null, ent);
      }
    });
  };

  /** load all matching entities */
  self.list$ = function(args, cb){
    var qent  = args.qent;
    var q     = args.q;
    //var mq = metaquery(qent,q);
    //var qq = fixquery(qent,q);
    var table = tablename(qent);
    var viewDesign = "seneca_collection_" + table;

    self.dbinst.view(viewDesign, table, {}, function(err, result){
      if(err){
        seneca.fail( {code:'list',tag:args.tag$, store:self.name,query:q,error:err},cb );
      } else {
        var list = [];
          _.each(result.rows, function(value){
              var ent = makeent(qent, value.value);
              list.push(ent);
          });

          if(!_.isEmpty(q)){
            list = _.filter(list, function(elem){
              var match = true;
              _.each(q, function(value, key){
                var computed = (elem[key] === value);
                match = match && computed;
              });
              return match;
            });
          }

          cb(null, list);
      }
    });
  };

  /** remove all matching entities */
  self.remove$ = function(args, cb){
    var qent = args.qent;
    var q    = args.q;
    var table = tablename(qent);
    var viewDesign = "seneca_collection_" + table;

    if(q.all$){
      self.dbinst.view(viewDesign, table, {}, function(err, result){
        if(err){
          seneca.fail( {code:'list',tag:args.tag$, store:self.name,query:q,error:err},cb );
        } else {
          var list = [];
          _.each(result.rows, function(value){
              var ent = makeent(qent, value.value);
              list.push(ent);
          });

          _.each(list, function(value){
            var id = value._id;
            var rev = value._rev;

            self.dbinst.removeDoc(id, rev, function(err, result){
              if(err){
                seneca.fail({code:'remove',tag:args.tag$,store:self.name,query:q,error:err}, cb);
              }
            });
          });

          cb(null, result);
        }
      });
    } else if(!_.isEmpty(q)){
      self.list$(args, function(err, elements){
        _.each(elements, function(value){
            var id = value._id;
            var rev = value._rev;

            self.dbinst.removeDoc(id, rev, function(err, result){
              cb(null, result);
            });
        });

      });
    }
  };


  /* close connection to data store - called during shutdown */
  self.close$ = function(args, cb){
    // CouchDB is HTTP based, there is nothing to close
    cb();
  };

  var selectstm = function(qent,q) {
    var stm = {};
    var table = tablename(qent);
    var params = [];
    var values = {};

    var w = whereargs(makeentp(qent),q);
    var wherestr = '';

    if( !_.isEmpty(w) ) {
      for(var param in w) {
        var fieldPlaceholder = '$' + param;
        params.push(param + ' = ' + fieldPlaceholder);
        values[fieldPlaceholder] = w[param];
      }

      wherestr = " WHERE " + params.join(' AND ');
    }

    var mq = metaquery(qent, q);
    var metastr = ' ' + mq.join(' ');

    stm.text = "SELECT * FROM " + table + wherestr + metastr;
    stm.values = values;

    return stm;
  };


  // var metaquery = function(qent,q) {
  //   var mq = [];

  //   if( q.sort$ ) {
  //     for( var sf in q.sort$ ) break;
  //     var sd = q.sort$[sf] < 0 ? 'ASC' : 'DESC';
  //     mq.push('ORDER BY '+sf+' '+sd);
  //   }

  //   if( q.limit$ ) {
  //     mq.push('LIMIT '+q.limit$);
  //   }

  //   return mq;
  // };

  var whereargs = function(qent, q) {
    var w = {};

    var qok = fixquery(qent,q);

    for(var p in qok) {
      w[p] = qok[p];
    }

    return w;
  };


  var fixquery = function(qent, q) {
    var qq = {};
    for( var qp in q ) {
      if( !qp.match(/\$$/) ) {
        qq[qp] = q[qp];
      }
    }
    return qq;
  };

  var metaquery = function(qent,q) {
    var mq = {};

    if( q.sort$ ) {
      for( var sf in q.sort$ ) break;
      var sd = q.sort$[sf] < 0 ? 'descending' : 'ascending';
      mq.sort = [[sf,sd]];
    }

    if( q.limit$ ) {
      mq.limit = q.limit$;
    }

    if( q.fields$ ) {
      mq.fields = q.fields$;
    }

    return mq;
  };

  self.configure = function(spec, cb) {
    self.spec = spec;

    var conf = 'string' == typeof(spec) ? null : spec;

    if(!conf) {
      conf = {};

      //couchdb://pass@host:port
      var urlM = /^couchdb:\/\/((.*?)@)?(.*?)(:?(\d+))$/.exec(spec);
      eyes.inspect(urlM, "UrlM:");
      conf.host = urlM[3];
      conf.password = urlM[2];
      conf.port = urlM[5];
      conf.port = conf.port ? parseInt(conf.port,10) : null;
    }

    // TODO: add auth support
    self.connection = couchdb.createClient(conf.port, conf.host);
    //self.connection.debug_mode = 1;

    // if(_.has(conf, 'auth') && !_.isEmpty(conf.auth)){
    //   self.connection.auth(conf.auth, function(err, message){
    //     seneca.log({tag$:'init'}, 'authed to ' + conf.host);
    //   });
    // }

    self.dbinst = self.connection.db(conf.database);
    self.dbinst.info(function(err, info){
      if(err !== null && err.error === 'not_found'){
        self.dbinst.create(function(err, result){
          if(err){
            seneca.fail({code:'init/error', store:self.name}, cb);
          } else {
            seneca.log({tag$:'init'}, 'database '+conf.database+' created.');
            cb(null, self);
          }
        });
      } else {
        cb(null, self);
      }
    });
  };

  function reconnect(){
    self.configure(self.spec, function(err, me){
      if( err ) {
        seneca.log(null, 'db reconnect (wait ' + self.waitmillis + 'ms) failed: ' + err);
        self.waitmillis = Math.min(2 * self.waitmillis, MAX_WAIT);
        setTimeout(
          function(){
            reconnect();
          }, self.waitmillis);
      } else {
        self.waitmillis = MIN_WAIT;
        seneca.log(null, 'reconnect ok');
      }
    });
  }

  function error(args, err, cb) {
    if(err) {
      if (!err.fatal) {
        return false;
      }

      seneca.log(args.tag$, 'error: ' + err);
      seneca.fail({code:'entity/error', store:self.name}, cb);
      return true;
    }

    return false;
  }

  /** called by seneca to initialise plugin */
  self.init = function(si, opts, cb) {
    parent.init(si, opts, function(){

      // keep a reference to the seneca instance
      seneca = si;

      self.configure(opts, function(err) {
        if(err) {
          return seneca.fail({code:'entity', store:self.name, error:err}, cb);
        }
        else cb();
      });
    });
  };

  self.db = function() {
    return self.dbinst;
  };

  return self;
}

var makeentp = function(ent) {
  var entp = {};
  var fields = ent.fields$();
  var type = {};

  fields.forEach(function(field){
    //entp[field] = ent[field];
    if(_.isDate(ent[field])) {
      type[field] = DATE_TYPE;
    } else if( _.isArray( ent[field]) ) {
      type[field] = ARRAY_TYPE;
    } else if( _.isObject( ent[field]) ) {
      type[field] = OBJECT_TYPE;
    }

    if(!_.isDate( ent[field]) && _.isObject(ent[field])) {
      entp[field] = JSON.stringify(ent[field]);
    } else {
      entp[field] = ent[field];
    }
  });

  if ( !_.isEmpty(type) ){
    entp[SENECA_TYPE_COLUMN] = JSON.stringify(type);
  }

  entp[SENECA_COLLECTION] = tablename(ent);

  return entp;
};

var makeent = function(ent, row) {
  var entp = {};
  var fields = _.keys(row);
  var senecatype = {};

  if( !_.isUndefined(row[SENECA_TYPE_COLUMN]) && !_.isNull(row[SENECA_TYPE_COLUMN]) ){
    senecatype = JSON.parse(row[SENECA_TYPE_COLUMN]);
  }

  if(!_.isUndefined(ent) && !_.isUndefined(row)) {
    fields.forEach(function(field){
      if(SENECA_TYPE_COLUMN != field){
        if( _.isUndefined( senecatype[field]) ) {
          entp[field] = row[field];
        } else if (senecatype[field] == OBJECT_TYPE){
          entp[field] = JSON.parse(row[field]);
        } else if (senecatype[field] == ARRAY_TYPE){
          entp[field] = JSON.parse(row[field]);
        } else if (senecatype[field] == DATE_TYPE){
          entp[field] = new Date(row[field]);
        }
      }
    });
  }

  entp['_id'] = row._id;
  entp['_rev'] = row._rev;
  entp[SENECA_COLLECTION] = tablename(ent);
  return ent.make$(entp);
};

var tablename = function (entity) {
  var canon = entity.canon$({object:true});
  return (canon.base?canon.base+'_':'')+canon.name;
};

module.exports = new CouchDBStore();
