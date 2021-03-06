/**
 * Created by pk on 5/24/2017.
 */
var moment = require('moment');
var date_validator = require('DateValidator').DateValidator;
var pg = require('pg');
var generic_pattern=/\d+\s\d+\s2\d\d\d-\d+-\d+\s\d\d:\d\d/;
var nodemailer = require('nodemailer');
const yargs = require('yargs');
// const sender = yargs.argv.sender_email;
// const username = yargs.argv.sender_username;
// const receiver = yargs.argv.receiver_email;

// create reusable transporter object using the default SMTP transport
//var transporter = nodemailer.createTransport('smtps://'+sender+':'+username+'@smtp.gmail.com');

timeCon='';
/* Database connection string */
const connectionString = "postgres://odoo:odoo@192.168.2.9:5432/mutual-erp-bank";
const client = new pg.Client(connectionString);
client.connect(function (err) {
    if(err) {
        console.log(err);
        throw err;
    }
    else {
        console.log("Postgres connected successfully");
        reset_modem(port)
    }
});

var serialport = require('serialport');
var SerialPort = serialport.SerialPort;


var port = new SerialPort(yargs.argv.port,{
    baudrate: 9600,
    parser: SerialPort.parsers.readline('\n')
});

port.on('data',onDataReceived);
function fetch_sms_index(data) {
    rec=data.toString().split(',');
    if((rec[0].split(":"))[0].trim()=="+CMTI"){
        console.log("Data Received at index number: "+rec[1]);
        sms_index = rec[1];
        return sms_index
    }
}
function onDataReceived(data) {
    //data.match(_pattern1) || data.match(_pattern2)|| data.match(_pattern3) || data.match(_pattern4) || data.match(_pattern5)
    if(data.match(generic_pattern)){
        data=data.toString().split(' ');
        if(data.length==4){
            if(dateValidation(data)){
                  saveSmsLogs(data);
                  checkVisit(data);
            }
            else {
                saveSmsLogs(data);
            }

        }
    }
}

function dataInsert(row,guard_visit_time,device_record,second_visit) {
    if (second_visit==0){
         query_ins = client.query("INSERT INTO mutual_guard_tracking" + "(bank_code,branch_code,address,city,visit_date,visit_time,force_code,device_no,card_no)" + "values('" + row.bank_code + "','" + row.branch_code + "','" + row.street +"','" + row.city + "','" + device_record[2] + "','" + timeCon + "','" + row.force_code +"','" + device_record[0] + "','" + device_record[1] + "')");
         console.log("\n>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>SMS Received>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> "
                + "\n" + "Device ID:", device_record[0]
                + "\n" + "Station ID:", device_record[1]
                + "\n" + "Date:", device_record[2]
                + "\n" + "Time:", device_record[3] +
                "\nConverted Time: ", guard_visit_time
                + "\n\n" + "SMS has been logged into db successfully");
    }
    else {
        var signal_id = client.query("SELECT id FROM mutual_guard_tracking WHERE card_no='"+ device_record[1] + "'"+"AND archive_signal is null order by id desc limit 1");
        signal_id.on('row', function(row) {
            query_ins=client.query("UPDATE public.mutual_guard_tracking SET visit_time_two='" + second_visit + "'"+",visit_date_two='"+device_record[2]+"'"+"WHERE id='"+ row.id + "'");
        });
        console.log("Data has been updated");
    }

}

function dateValidation(dt) {
    dtarr=dt[2].toString().split('-');
    console.log(dtarr);
    console.log("is the date valid:"+date_validator.validate(dtarr[0],dtarr[1],dtarr[2]));
    return date_validator.validate(dtarr[0],dtarr[1],dtarr[2]);
}

function saveSmsLogs(data) {
    var now1= moment().format().toString();
    query_ins = client.query("INSERT INTO sms_logs" + "(device_id,card_id,date,time,sys_date)" + "values('" + data[0] + "','" + data[1] + "','" + data[2] +"','" + data[3] +"','" +now1+"')");
    console.log("SMS has been logged")
}
/* Function for checking visits for patrolling */
function checkVisit(record) {
    signal_id = '';
    //converts time from 24hr to 12hr
    timeCon = tConvert(record[3].toString().trim());
    //fetch record from db
    var check_signal = client.query("SELECT * FROM mutual_guard_tracking WHERE card_no='"+ record[1] + "'"+"AND archive_signal is null order by id desc limit 1");
    query_s = client.query("SELECT bank_code,branch_code,street,city,force_code FROM res_partner WHERE rf_id='" + record[1] + "'");
    check_signal.on('end', function(result) {
        if(result.rowCount == 0){
            query_s.on('row', function (row) {
                dataInsert(row,timeCon,record,0)
            });
        }
        else {
            var first_visit = result.rows[0].visit_time;
            var second_visit = result.rows[0].visit_time_two;
            var guard_visit=timeCon;
            diff='';
            if(first_visit && second_visit){
                if(second_visit.indexOf('PM')>1 && guard_visit.indexOf('AM')>1){
                    var startTime = moment(second_visit, "HH:mm a");
                    var endTime = moment(guard_visit, "HH:mm a");
                    var diff = moment(startTime.add(1,'days')).diff(endTime,'minutes');

                }
                else {
                    var startTime = moment(second_visit, "HH:mm a");
                    var endTime = moment(guard_visit, "HH:mm a");
                    var diff = Math.abs(moment(startTime).diff(endTime,'minutes'));
                }
                if(diff>15){
                    query_s.on('row', function (row) {
                        console.log(">>>>>>>>>>>>>>>>>>>ROW ID>>>>>>>>>>>>>>>>>>",row);
                        dataInsert(row,second_visit,record,0);
                    });
                }

            }
            else {
                if(first_visit.indexOf('PM')>1 && guard_visit.indexOf('AM')>1){
                    var startTime = moment(first_visit, "HH:mm a");
                    var endTime = moment(guard_visit, "HH:mm a");
                    var diff = moment(endTime.add(1,'days')).diff(startTime,'minutes');
                }
                else {
                    var startTime = moment(first_visit, "HH:mm a");
                    var endTime = moment(guard_visit, "HH:mm a");
                    var diff = Math.abs(moment(endTime).diff(startTime,'minutes'));
                }
                if(diff>15){
                    query_s.on('row', function (row) {
                        dataInsert(row,first_visit,record,guard_visit);
                    });
                }
            }
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
    if(parseInt(index)==1){
        console.log("Deleting messaage at index:"+index);
        serial.write("AT+CMGD="+index);
        serial.write('\r');
    }
    else {
        reset_modem(serial);
    }
}

function reset_modem(serial) {
    setTimeout(function () {
        serial.write("AT+CMGD=1,4");
        serial.write('\r');
        console.log("Memory of modem has been cleared");
    },1000);
}
