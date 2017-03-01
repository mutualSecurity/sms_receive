/**
 * Created by pk on 2/11/2017.
 */
const gsm     = require('gsm2');
const Modem   = require('gsm2/modem');
const Message = require('gsm2/pdu');

const modem = new Modem({port:'COM8'});

modem.open(function(err){

  modem.on('message', function(message){
    console.log('gsm modem received sms message',message);
  });


  modem.on('call', function(number){
    cnsole.log('gsm modem have a phone call from %s', number);
  });

  var message = new Message('+8618510100102', 'Hello GSM Modem!');
  modem.sendSMS(message, function(err){
    console.log('gsm modem: message sent!');
  });

/*  modem.getSMS(function(err, messages){
    console.log(messages);
  });

  modem.delSMS(function(err){
    console.log('all messages was deleted');
  });*/

});