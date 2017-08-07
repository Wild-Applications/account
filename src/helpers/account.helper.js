//Authenticate Router
//Username and Password Login

//imports
var mysql      = require('mysql');


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

account.authenticate = function(call, callback){
  // var token = jwt.sign({
  //   auth: 'magic',
  //   id: '0'
  // },'michaelwildchangethisplease');
  // token = tokenService.generateToken();

  pool.getConnection(function(err, connection) {
    if (err) {
      callback({message:'0001 - Failed to connect to the database'},null);
    }
    var query = "SELECT _id FROM users WHERE username = '" + call.request.username + "'";
    connection.query(query, function(error, results){
      connection.release();
      if(err){callback({message:'0002 - Failed to run query against the database'},null);}
      if(typeof results != 'undefined'){
        if(results.length != 0){
          //user exists so verify password matches
          var result = verifyPassword();
          if(result == false){
            //password doesn't exist
            callback({message:'0005 - Username or Password did not match'}, null);
          }else{
            //password matches. Return user id
            callback(null, results[0]);
          }
        }else{
          //no results
          callback({message:'0003 - No user exists with that username'},null);
        }
      }else{
        callback({message:'0003 - No user exists with that username'},null);
      }
    });
  });
}

account.create = function(call, callback){
  connection.connect(function(err){
    if(err){
      callback({code:'0001', message:'Failed to connect to the database'},null);
    }
    var query = "INSERT INTO users (username, email) VALUES ('"+call.request.username+"', '"+call.request.email+"')";
    connection.query(query, function(error, results){
        if(err){callback({code:'0004', message:'Unable to create new user'}, null);}
        if(typeof results != 'undefined'){
          callback(null, results);
        }else{
          //this cant happen?
          callback({}, null);
        }
        connection.end();
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
    authenticationClient.authenticate(body, function(err,response){
      if(err){ return false };
    });
  }else{
    return true;
  }
}

module.exports = account;
