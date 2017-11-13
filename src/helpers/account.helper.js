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
  password        : 'Secretbeckyy95',
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

account.checkEmail = function(call, callback){
  pool.getConnection(function(err, connection) {
    if (err) {
      return callback({message:JSON.stringify({code:'01060001', error:errors['0001']})}, null);
    }
    var query = "SELECT _id FROM users WHERE email = '" + call.request.email + "'";
    connection.query(query, function(error, results){
      connection.release();
      if(err){return callback({message:JSON.stringify({code:'01030002', error:errors['0004']})}, null);}
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

account.checkUsername = function(call, callback){
  pool.getConnection(function(err, connection) {
    if (err) {
      return callback({message:JSON.stringify({code:'01060001', error:errors['0001']})}, null);
    }
    var query = "SELECT _id FROM users WHERE username = '" + call.request.username + "'";
    console.log(query);
    connection.query(query, function(error, results){
      connection.release();
      if(error){return callback({message:JSON.stringify({code:'01030002', error:errors['0004']})}, null);}
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
      if(err){return callback({message:JSON.stringify({code:'01000004', error:errors['0004']})}, null);}
      if(typeof results != 'undefined'){
        if(results.length != 0){
          //user exists so verify password matches
          var result = verifyPassword(results[0]._id, call.request.password, callback);
        }else{
          //no results
          return callback({message:JSON.stringify({code:'01010004', error:errors['0004']})}, null);
        }
      }else{
        return callback({message:JSON.stringify({code:'01020004', error:errors['0004']})}, null);
      }
    });
  });
}

account.recover = function(call, callback){
  pool.getConnection(function(err, connection) {
    if (err) {
      return callback({message:JSON.stringify({code:'01020001', error:errors['0001']})}, null);
    }
    var query = "SELECT _id FROM users WHERE username = '" + call.request.email + "' OR email = '" + call.request.email + "'";
    connection.query(query, function(error, results){
      connection.release();
      if(err){return callback({message:JSON.stringify({code:'01020003', error:errors['0003']})}, null);}
      if(typeof results != 'undefined'){
        if(results.length != 0){
          callback({message:'testing storage'}, null);
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
  //call.verification
  //call.password
  //find the associated verification and user id

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
                    emailClient.send({recipient:"michael@tabap.co.uk", subject:"Testing Email from Service", content:"Fuck me it worked"}, function(err, callback){
                      if(err){
                        return callback({message:JSON.stringify(err)}, null);
                      }else{
                        callback(null, {token: generateToken(passwordResult._id)});
                      }
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


function verifyPassword(_id, password, callback){

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
        return callback(err, null);
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

function generateToken(_id){
  return jwt.sign({
    iss: 'http://app.com/users/',
    sub: _id,
    jti: 1,
    iat: Math.floor(Date.now() / 1000) - 30
  },process.env.JWT_SECRET, {expiresIn: 60 * 60 * 12});
}

module.exports = account;
