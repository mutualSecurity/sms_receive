var serialport = require('serialport');
var SerialPort = serialport.SerialPort;
var pg = require('pg');
var split = require('split');
const yargs = require('yargs');

/* Database connection string */
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

/* GSM Modem Connection String */
var port = new SerialPort(yargs.argv.port,{
   baudrate: 921600
});

port.on('open',onOpen);
port.on('data',onDataReceived);

/* Function for conversion of Time from 24hr to 12hr */
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

/* Function for insertion of data into database */
function dataInsert(record,messageIndex) {
    // This line breaks received sms into array
    record = record.split(' ');
    if(record.length == 4) {
        //converts time from 24hr to 12hr
        timeCon = tConvert(record[3].toString().trim());
        //fetch record from db
        var query_s = client.query("SELECT bank_code,branch_code,street FROM res_partner WHERE rf_id='" + record[1] + "'");
        // Stream results back one row at a time
        query_s.on('row', function (row) {
            //row is the record of table
            query_ins = client.query("INSERT INTO mutual_guard_tracking(bank_code,branch_code,address,visit_date,visit_time,device_no)values('" + row.bank_code + "','" + row.branch_code + "','" + row.street + "','" + record[2] + "','" + timeCon + "','" + record[0] + "')");
            console.log("\n>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>SMS Received>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> "
                + "\n" + "Device ID:", record[0]
                + "\n" + "Station ID:", record[1]
                + "\n" + "Date:", record[2]
                + "\n" + "Time:", record[3] +
                "\nConverted Time: ", timeCon
                + "\n\n" + "SMS has been logged into db successfully");
            del(port,messageIndex);
        });
    }
    else {
        del(port);
    }
}

/* Function for checking that COM port is open or not */
function onOpen(err) {
    if(!err){
        console.log("Successfully Connected");
    }
}

/* Function for receiving of sms from sim and modem both */
function onDataReceived(data) {
    data = data.toString();
    //console.log(data);
    var arr = data.split('\n');
    //console.log(arr);
    if (arr[0] == '\r' && arr.length >3)
    {
        //console.log(((arr[1].split(','))[0].split(':'))[1].trim());
        if(((arr[1].split(','))[0].split(':'))[1] != undefined ){
            dataInsert(arr[2],((arr[1].split(','))[0].split(':'))[1].trim())
        }

    }
    else {
        del(port,undefined)
    }
}

/* Function for reading of sms from sim and modem both */
function read(serial) {
    serial.write("AT+CMGF=1");
    serial.write('\r');
    serial.write("AT+CPMS=\"SM\"");
    serial.write('\r');
    serial.write("AT+CMGL=\"ALL\"");
    serial.write('\r');
}

/* Function for deletion of sms after logged into database */
function del(serial,messageIndex) {
   if(messageIndex != undefined){
        serial.write("AT+CMGF=1");
        serial.write('\r');
        serial.write("AT+CMGD="+messageIndex);
        serial.write('\r');
        console.log("SMS has been deleted");
    }
    else {
        serial.write("AT+CMGF=1");
        serial.write('\r');
        serial.write("AT+CMGD=1,1");
        serial.write('\r');
    }
}

setInterval(function(){ read(port) }, 3000);

