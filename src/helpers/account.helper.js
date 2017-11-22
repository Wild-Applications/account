//Authenticate Router
//Username and Password Login

//imports
var mysql      = require('mysql'),
jwt            = require('jsonwebtoken'),
errors         = require('../errors/errors.json');

//database config
var pool = mysql.createPool({
  connectionLimit : 10,
  host            : 'bleuapp.cqvfnrmvten1.us-west-2.rds.amazonaws.com',
  port            : '3306',
  user            : 'bleuadmin',
  password        : process.env.DB_PASS,
  database        : 'usrdb'
});

var grpc = require("grpc");
var authenticationDescriptor = grpc.load(__dirname + '/../proto/authentication.proto').authentication;
var authenticationClient = new authenticationDescriptor.AuthenticationService('service.authentication:1295', grpc.credentials.createInsecure());

var premisesDescriptor = grpc.load(__dirname + '/../proto/premises.proto').premises;
var premisesClient = new premisesDescriptor.PremisesService('service.premises:1295', grpc.credentials.createInsecure());

var emailDescriptor = grpc.load(__dirname + '/../proto/email.proto').email;
var emailClient = new emailDescriptor.EmailService('service.email:1295', grpc.credentials.createInsecure());


var account = {};

account.getAccount = function(call, callback){
  //protected route so verify token;
  jwt.verify(call.metadata.get('authorization')[0], process.env.JWT_SECRET, function(err, token){
    if(err){
      return callback({message:err},null);
    }
    pool.getConnection(function(err, connection){
      if(err){
        return callback({message:JSON.stringify({code:'01000001', error:errors['0001']})}, null);
      }
      var query = "SELECT username, email FROM users where _id = " + token.sub + " LIMIT 1";
      connection.query(query, function(error, results){
        connection.release();
        if(err){return callback({message:JSON.stringify({code:'01000002', error:errors['0002']})}, null);}
        if(typeof results != 'undefined'){
          if(results.length != 0){
            callback(null, results[0]);
          }else{
            return callback({message:JSON.stringify({code:'01000003', error:errors['0003']})}, null);
          }
        }else{
          return callback({message:JSON.stringify({code:'01010003', error:errors['0003']})}, null);
        }
      });
    });
  });
}

account.checkUsername = function(call, callback){
  pool.getConnection(function(err, connection) {
    if (err) {
      return callback({message:JSON.stringify({code:'01060001', error:errors['0001']})}, null);
    }
    var query = "SELECT _id FROM users WHERE username = '" + call.request.username + "'";
    console.log(query);
    connection.query(query, function(error, results){
      connection.release();
      if(error){return callback({message:JSON.stringify({name:'01030002', message:errors['0002']})}, null);}
      if(typeof results != 'undefined'){
        if(results.length != 0){
          //user exists so verify password matches
          callback(null, {taken: true});
        }else{
          //no results
          return callback(null, {taken: false});
        }
      }else{
        return callback(null, {taken: false});
      }
    });
  });
}

account.authenticate = function(call, callback){
  pool.getConnection(function(err, connection) {
    if (err) {
      return callback({message:JSON.stringify({code:'01010001', error:errors['0001']})}, null);
    }
    console.log(call.request.accountType);
    if(call.request.accountType == "CUSTOMER"){
      call.request.client = false;
      call.request.customer = true;
    }else{
        call.request.client = true;
        call.request.customer = false;
    }
    var query = "SELECT _id FROM users WHERE (username = '" + call.request.username + "' OR email = '" + call.request.username + "') AND client = " + call.request.client + " AND customer = " + call.request.customer;
    console.log(query);
    connection.query(query, function(error, results){
      connection.release();
      if(err){
        return callback({name:'01000004', message:errors['0004']}, null);
      }
      if(typeof results != 'undefined'){
        if(results.length != 0){
          //user exists so verify password matches
          console.log("Verifying passwor");
          var result = verifyPassword(results[0]._id, call.request.password, call.request.accountType, callback);
        }else{
          //no results
          return callback({name:'01010004', message:errors['0004']}, null);
        }
      }else{
        return callback({name:'01020004', message:errors['0004']}, null);
      }
    });
  });
}

account.recover = function(call, callback){
  pool.getConnection(function(err, connection) {
    if (err) {
      return callback({message:JSON.stringify({code:'01020001', error:errors['0001']})}, null);
    }
    var query = "SELECT _id, email FROM users WHERE username = '" + call.request.email + "' OR email = '" + call.request.email + "'";
    connection.query(query, function(error, results){
      connection.release();
      if(err){return callback({message:JSON.stringify({code:'01020003', error:errors['0003']})}, null);}
      if(typeof results != 'undefined'){
        if(results.length != 0){
          authenticationClient.requestReset({_id: results[0]._id}, function(err, response){
            if(err){
              console.log(err);
              return callback(err, null);
            }else{
              if(response.guid){
                emailClient.send({recipient: results[0].email, subject: "Password Reset", content:response.guid}, function(err, response){
                  if(err){
                    return callback(err, null);
                  }
                  return callback(null,{recovery:true});
                });
              }
            }
          })
        }else{
          //no results
          //in this case we dont want the user to know if an account with that username/email exists
          //so we return true anyway
          return callback(null,{response: true});
        }
      }else{
        return callback(null,{response: true});
      }
    });
  });
}

account.resetPassword = function(call, callback){
  //this shouldnt touch the user database so no need to get a connection object
  if(call.request.guid && call.request.password){
    authenticationClient.resetPassword({guid: call.request.guid, password: call.request.password}, function(err, response){
      if(err){
        return callback(err, null);
      }
      console.log("result", response);
      return callback(null, {successful:response.reset});
    });
  }
}

account.create = function(call, callback){
  pool.getConnection(function(err,connection){
    if(err){
      return callback({message:JSON.stringify({code:'01030001', error:errors['0001']})}, null);
    }
    connection.beginTransaction(function(err){
      if(err){
        return callback({message:JSON.stringify({code:'01040001', error:errors['0001']})}, null);
      }
      if(call.request.accountType == "CLIENT"){
        call.request.customer = false;
        call.request.client = true;
      }else{
        call.request.customer = true;
        call.request.client = false;
      }
      var query = "INSERT INTO users (username, email, customer, client) VALUES ('"+call.request.username+"', '"+call.request.email+"', "+call.request.customer+", "+call.request.client+")";
      connection.query(query, function(error, results){
          if(error){
            connection.rollback(function(){
              callback({message:JSON.stringify({code:'01000005', error:errors['0005']})}, null);
            })
          }else{
            storePassword(results.insertId, call.request.password, connection, function(err, passwordResult){
              if(err){
                return connection.rollback(function(){
                  callback({message:err}, null);
                });
              }else{
                connection.commit(function(err){
                  if(err){
                    connection.rollback(function(){
                      //need to delete password
                      return callback({message:JSON.stringify({code:'01000006', error:errors['0006']})}, null);
                    })
                  }else{
                    emailClient.send({recipient:"michael@tabapp.co.uk", subject:"Testing Email from Service", content:"Fuck me it worked"}, function(err, result){
                      if(err){
                        console.log(err);
                      }
                      callback(null, {token: generateToken(passwordResult._id, call.request.accountType)});
                    })
                  }
                })

              }
            });
          }
      });
    });
  });
}


function verifyPassword(_id, password, type,callback){

  if( _id && password ){
    //call the authentication service
    var body = {};
    body._id = _id;
    body.password = password;
    authenticationClient.authenticateUser(body, function(err,response){
      if(err){ return callback(err, null);};
      //
      console.log(err);
      console.log(response.authenticated);
      if(response.authenticated){
        console.log('about to gen token');
        callback(null,{token:generateToken(_id, type)});
      }else{
        return callback({code: 401, status:grpc.status.UNAUTHENTICATED, message:errors['0004'], status:402}, null);
      }
    });
  }else{
    return callback({message:JSON.stringify({code:'01000007', error:errors['0007']})}, null);
  }
}

function storePassword(_id, password, connection, callback){

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
          return callback(err, null);
        }
      }
    });
  }else{
    return callback({message:JSON.stringify({code:'01010007', error:errors['0007']})}, null);
  }
}





//--------------

function generateToken(_id, type){
  var expiresIn = 60 * 60 * 12;
  if(type == "CUSTOMER"){
    //expires in a month
    expiresIn = expiresIn * 2 * 31;
  }
  return jwt.sign({
    iss: 'http://app.com/users/',
    sub: _id,
    jti: 1,
    iat: Math.floor(Date.now() / 1000) - 30
  },process.env.JWT_SECRET, {expiresIn: expiresIn});
}

module.exports = account;
