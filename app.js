// var date_validator = require('DateValidator').DateValidator;
// var is_valid = date_validator.validate("2017","13","29");
// console.log(is_valid);
var dateValidator=require('moment');
console.log(dateValidator('2017-04-30', 'YYYY-MM-DD',true).isValid());