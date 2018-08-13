var kue = require('kue'), 
    queue = kue.createQueue();
const admin = require('firebase-admin');

var serviceAccount = require('./eskolltrack-33e040245dd0.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

var db = admin.firestore();

var docRef = db.collection('users').doc('alovelace');

var setAda = docRef.set({
  first: 'Ada',
  last: 'Lovelace',
  born: 1815
});

// queue.process('pubg', function(stat, done){
//     console.log(stat.data);
//     done();
// });