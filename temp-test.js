const mailer = require('./mailer');
const recipients = 'test1@example.com\nJohn Doe,test2@example.com\n   test3@example.com  ';
console.log(mailer.parseRecipients(recipients));
