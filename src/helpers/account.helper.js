//Authenticate Router
//Username and Password Login

//imports
var mysql      = require('mysql');
var connection = mysql.createConnection({
  host     : 'bleuapp.cqvfnrmvten1.us-west-2.rds.amazonaws.com',
  port     : '3306',
  user     : 'bleuadmin',
  password : 'Secretbeckyy95',
  database : 'usrdb'
});

//var jwt = require('jsonwebtoken');
//var tokenService = require('bleuapp-token-service').createTokenHandler('service.token', '50051');

var authenticator = {};

authenticator.authenticate = function(call, callback){
  // var token = jwt.sign({
  //   auth: 'magic',
  //   id: '0'
  // },'michaelwildchangethisplease');
  // token = tokenService.generateToken();

  connection.connect(function(err) {
    if (err) {
      callback({code:'0001', message:'Failed to connect to the database'},null);
    }
    var query = "SELECT _id FROM users WHERE username = '" + call.request.username + "'";
    connection.query(query, function(error, results){
      if(err){callback({code:'0002', message:'Failed to run query against the database'},null);}
      if(typeof results != 'undefined'){
        if(results.length != 0){
          callback(null,results[0]);
        }else{
          //no results
          callback({code: '0003',message:'No user exists with that username'},null);
        }
      }else{
        callback({code: '0003',message:'No user exists with that username'},null);
      }
      connection.end();
    });
  });
}

authenticator.create = function(call, callback){
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

module.exports = authenticator;
