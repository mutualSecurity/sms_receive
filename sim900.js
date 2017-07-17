/**
 * Created by pk on 5/24/2017.
 */
var pg = require('pg');
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

var serialport = require('serialport');
var SerialPort = serialport.SerialPort;
const yargs = require('yargs');

var port = new SerialPort(yargs.argv.port,{
    baudrate: 115200,
    dataBits: 8,
    parity: 'none',
    stopBits: 1,
    flowControl:false,
    parser: SerialPort.parsers.readline('\n')
});

port.on('data',onDataReceived);
function onDataReceived(data) {
    data=data.toString().split(' ');
    if(data.length==4){
        //console.log("Received Data:"+data);
        dataInsert(data)
    }
}

/* Function for insertion of data into database */
function dataInsert(record) {
    //converts time from 24hr to 12hr
    timeCon = tConvert(record[3].toString().trim());
    //fetch record from db
    var query_s = client.query("SELECT bank_code,branch_code,street,city,force_code FROM res_partner WHERE rf_id='" + record[1] + "'");
    // Stream results back one row at a time
    query_s.on('row', function (row) {
        if(row){
            //row is the record of table
            query_ins = client.query("INSERT INTO mutual_guard_tracking(bank_code,branch_code,address,city,visit_date,visit_time,force_code,device_no)values('" + row.bank_code + "','" + row.branch_code + "','" + row.street +"','" + row.city + "','" + record[2] + "','" + timeCon + "','" + row.force_code +"','" + record[0] + "')");
            console.log("\n>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>SMS Received>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> "
                + "\n" + "Device ID:", record[0]
                + "\n" + "Station ID:", record[1]
                + "\n" + "Date:", record[2]
                + "\n" + "Time:", record[3] +
                "\nConverted Time: ", timeCon
                + "\n\n" + "SMS has been logged into db successfully");
        }
    });
}

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

port.on('data',function (data) {
    data = data.toString().split(',');
    //console.log(data);
    if((data[0].split(":"))[0].trim()=="+CMTI"){
        //console.log("Data Received at index number: "+data[1]);
        readText(port,data[1]);
        setTimeout(function(){
             del(port,data[1])
        }, 500);
    }
});

function readText(serial,index) {
    console.log("Reading... SMS at index "+index);
    serial.write("AT+CMGR="+index);
    serial.write('\r');
}

function del(serial,index) {
    console.log("Deleting SMS at index....."+index);
    serial.write("AT+CMGD="+index);
    serial.write('\r');
}