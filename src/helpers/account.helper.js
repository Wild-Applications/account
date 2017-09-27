//Authenticate Router
//Username and Password Login

//imports
var mysql      = require('mysql'),
jwt            = require('jsonwebtoken');

//database config
var pool = mysql.createPool({
  connectionLimit : 10,
  host            : 'bleuapp.cqvfnrmvten1.us-west-2.rds.amazonaws.com',
  port            : '3306',
  user            : 'bleuadmin',
  password        : 'Secretbeckyy95',
  database        : 'usrdb'
});

//var jwt = require('jsonwebtoken');
//var tokenService = require('bleuapp-token-service').createTokenHandler('service.token', '50051');

var account = {};

account.getAccount = function(call, callback){
  //protected route so verify token;
  jwt.verify(call.metadata.get('authorization')[0], process.env.JWT_SECRET, function(err, token){
    if(err){
      return callback({message:err},null);
    }
    pool.getConnection(function(err, connection){
      if(err){
        return callback({message:JSON.stringify({code:'0001', message:'Failed to connect to the database'})}, null);
      }
      var query = "SELECT username, email FROM users where _id = " + token.sub + " LIMIT 1";
      connection.query(query, function(error, results){
        connection.release();
        if(err){return callback({message:JSON.stringify({code:'0002', message:'Failed to run query against database'})}, null);}
        if(typeof results != 'undefined'){
          if(results.length != 0){
            callback(null, results[0]);
          }else{
            return callback({message:JSON.stringify({code:'0005', message:'Username or password did not match', status: 401})}, null);
          }
        }else{
          return callback({message:JSON.stringify({code:'0005', message:'Username or password did not match', status: 401})}, null);
        }
      });
    });
  });
}

account.authenticate = function(call, callback){
  // var token = jwt.sign({
  //   auth: 'magic',
  //   id: '0'
  // },'michaelwildchangethisplease');
  // token = tokenService.generateToken();
  pool.getConnection(function(err, connection) {
    if (err) {
      return callback({message:JSON.stringify({code:'0001', message:'Failed to connect to the database'})}, null);
    }
    var query = "SELECT _id FROM users WHERE username = '" + call.request.username + "' OR email = '" + call.request.username + "'";
    connection.query(query, function(error, results){
      connection.release();
      if(err){return callback({message:JSON.stringify({code:'0002', message:'1Username or password did not match'})}, null);}
      if(typeof results != 'undefined'){
        if(results.length != 0){
          //user exists so verify password matches
          var result = verifyPassword(results[0]._id, call.request.password, callback);
        }else{
          //no results
          return callback({message:JSON.stringify({code:'0005', message:'2Username or password did not match'})}, null);
        }
      }else{
        return callback({message:JSON.stringify({code:'0005', message:'3Username or password did not match'})}, null);
      }
    });
  });
}

account.create = function(call, callback){
  pool.getConnection(function(err,connection){
    if(err){
      return callback({message:JSON.stringify({code:'0001', message:'Failed to connect to the database'})}, null);
    }
    connection.beginTransaction(function(err){
      if(err){
        return callback({message:JSON.stringify({code:'0001', message:'Failed to connect to the database'})}, null);
      }
      var query = "INSERT INTO users (username, email) VALUES ('"+call.request.username+"', '"+call.request.email+"')";
      console.log(query);
      connection.query(query, function(error, results){
          if(error){
            console.log(error.sqlMessage);
            connection.rollback(function(){
              callback({message:JSON.stringify({code:'0014', message:'User already exists'})}, null);
            })
          }else{
            console.log(results);
            storePassword(results.insertId, call.request.password, connection, function(err, passwordResult){
              if(err){
                return connection.rollback(function(){
                  callback({message:JSON.stringify({code:'0004', message:'2Unable to create new user'})}, null);
                });
              }else{
                connection.commit(function(err){
                  if(err){
                    connection.rollback(function(){
                      return callback({message:JSON.stringify({code:'0004', message:'4Unable to create new user'})}, null);
                    })
                  }else{
                    callback(null, {token: generateToken(passwordResult._id)});
                  }
                })

              }
            });
          }
      });
    });
  });
}


function verifyPassword(_id, password, callback){
  var grpc = require("grpc");
  var authenticationDescriptor = grpc.load(__dirname + '/../proto/authentication.proto').authentication;
  var authenticationClient = new authenticationDescriptor.AuthenticationService('service.authentication:1295', grpc.credentials.createInsecure());

  if( _id && password ){
    //call the authentication service
    var body = {};
    body._id = _id;
    body.password = password;
    authenticationClient.authenticateUser(body, function(err,response){
      if(err){ return callback(err, null);};
      //
      if(response.authenticated){
        console.log('about to gen token');
        callback(null,{token:generateToken(_id)});
      }else{
        return callback({message:JSON.stringify({code:'0005', message:'BUsername or password did not match'})}, null);
      }
    });
  }else{
    return callback({message:JSON.stringify({code:'0011', message:'CUsername and password were not supplied'})}, null);
  }
}

function storePassword(_id, password, connection, callback){
  var grpc = require("grpc");
  var authenticationDescriptor = grpc.load(__dirname + '/../proto/authentication.proto').authentication;
  var authenticationClient = new authenticationDescriptor.AuthenticationService('service.authentication:1295', grpc.credentials.createInsecure());

  if(_id && password ){
    var body = {};
    body._id = _id;
    body.password = password;
    authenticationClient.storeUser(body, function(err, response){
      if(err){
        //storage of the password failed. Rollback the creation of a new user in the user table
        connection.rollback(function(){
          callback(err, null);
        });
      }else{
        if(response.stored){
          var res = {};
          res._id = _id;
          //callback({message:'we got here'}, null);return;
          callback(null, res);
          return;
        }else{
          callback({message:'Unable to store user'},null);
        }
      }
    });
  }else{
    callback({message:'0011 - Account Id or Password were not suppled'}, null);
  }
}

function createPremises(_id, callback){
  var grpc = require("grpc");
  var premisesDescriptor = grpc.load(__dirname + '/../proto/premises.proto').premises;
  var premisesClient = new premisesDescriptor.PremisesService('service.premises:1295', grpc.credentials.createInsecure());

  if(_id){
    var body = {};
    body.name = "";
    body.description = "";
    body.owner = _id;
    premisesClient.create(body, function(err, result){
      if(err){
        return callback({message:'unable to create premises'});
      }else{
        return callback(null, result);
      }
    });
  }
}




//--------------

function generateToken(_id){
  return jwt.sign({
    iss: 'http://app.com/users/',
    sub: _id,
    jti: 1,
    iat: Math.floor(Date.now() / 1000) - 30
  },process.env.JWT_SECRET, {expiresIn: 60 * 60 * 12});
}

module.exports = account;
