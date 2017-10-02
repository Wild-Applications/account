//Account service

//Imports
const grpc = require('grpc');
const accountHelper = require('./helpers/account.helper.js');
const proto = grpc.load(__dirname + '/proto/account.proto');
const server = new grpc.Server();

//define the callable methods that correspond to the methods defined in the protofile
server.addService(proto.account.AccountService.service, {
  get: function(call, callback){
    accountHelper.getAccount(call, callback);
  },
  create: function(call, callback){
    accountHelper.create(call,callback);
  },
  authenticate: function(call, callback){
    accountHelper.authenticate(call,callback);
  },
  recover: function(call, callback){
    accountHelper.recover(call, callback);
  }

});

//Specify the IP and and port to start the grpc Server, no SSL in test environment
server.bind('0.0.0.0:50051', grpc.ServerCredentials.createInsecure());

//Start the server
server.start();
console.log('gRPC server running on port: 50051');
