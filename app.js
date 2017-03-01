var serialport = require('serialport');
var SerialPort = serialport.SerialPort;
var pg = require('pg');
var date= require('node-datetime');
var currdate = date.create();
var format = currdate.format('Y-m-d');
const connectionString = "postgres://odoo:odoo@localhost/mutual-erp-bank";
const client = new pg.Client(connectionString);
client.connect(function (err) {
    if(err) {
        throw err;
    }
    else {
        console.log("Postgres connected successfully");
    }
});
var split = require('split');
var port = new SerialPort("COM8",{
   baudrate: 921600
});

port.on('open',onOpen);
port.on('data',onDataReceived);

function tConvert (time) {
  // Check correct time format and split into components
  time = time.toString ().match (/^([01]\d|2[0-3])(:)([0-5]\d)(:[0-5]\d)?$/) || [time];
  if (time.length > 1) { // If time format correct
    time = time.slice (1);  // Remove full string match value
    time[5] = +time[0] < 12 ? 'AM' : 'PM'; // Set AM/PM
    time[0] = +time[0] % 12 || 12; // Adjust hours
  }
  return time.join (''); // return adjusted time or original string
}

function dataInsert(record) {
    // Stream results back one row at a time
    record = record.split(' ');
    timeCon = tConvert(record[3].toString().trim());
    //console.log('Time Con',timeCon);
    var query_s = client.query("SELECT bank_code,branch_code,street FROM res_partner WHERE rf_id='"+record[1]+"'");
    query_s.on('row',function (row) {
        console.log(row);
        query_ins = client.query("INSERT INTO mutual_guard_tracking(bank_code,branch_code,address,visit_date,visit_time,device_no)values('"+row.bank_code+"','"+row.branch_code+"','"+row.street+"','"+format+"','"+timeCon+"','"+record[0]+"')");
        console.log(record);
        del(port);
    });
}

function onOpen(err) {
    if(!err){
        console.log("Successfully Connected");
    }
}

function onDataReceived(data) {
    data = data.toString();
    var arr = data.split(',');
    try {
    // the synchronous code that we want to catch thrown errors on
        if (arr[4] !== undefined){
            var narr = arr[4].split('\n');
            if (narr[1] !== undefined){
                dataInsert(narr[1]);
               // console.log("jo manga tha: "+ narr[1] );
                //query = client.query("INSERT INTO guard_tracking(card_no)values('"+narr[1]+"')");
            }
        }
    } catch (err) {
        console.log(err)
    }
}

function read(serial) {
    serial.write("AT+CMGF=1");
    serial.write('\r');
    serial.write("AT+CPMS=\"MT\"");
    serial.write('\r');
    serial.write("AT+CMGL=\"REC READ\"");
    serial.write('\r');
}

function del(serial) {
    serial.write("AT+CMGF=1");
    serial.write('\r');
    serial.write("AT+CMGD=1,0");
    serial.write('\r');
}

setInterval(function(){ read(port) }, 3000);

//REC UNREAD
//AT+CMGF=1 // Set the GSM Module in text mode
//AT+CNMI=2,2,0,0,0 // AT Command to receive live sms
//SM sim
//ME modem
//MT both from sim n modem

