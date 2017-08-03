//Account service

//Imports
const grpc = require('grpc');
const authenticationHelper = require('./helpers/account.helper.js');
const proto = grpc.load(__dirname + '/proto/account.proto');
const server = new grpc.Server();

//define the callable methods that correspond to the methods defined in the protofile
server.addService(proto.account.AccountService.service, {
  get: function(call, callback){
    callback(null, {_id:1});
  },
  create: function(call, callback){
    callback(null,{_id:1});
  }

});

//Specify the IP and and port to start the grpc Server, no SSL in test environment
server.bind('0.0.0.0:50051', grpc.ServerCredentials.createInsecure());

//Start the server
server.start();
console.log('gRPC server running on port: 50051');
