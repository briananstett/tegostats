var kue= require('kue'),
    que= kue.createQueue();
const admin = require('firebase-admin');
const serviceAccount = require('./config/tegoesports-firebase-adminsdk-7vcjc-f7fe6375b6.json');

//Initialize Firebase
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});
var db = admin.firestore();
var FieldValue = admin.firestore.FieldValue;
db.settings({timestampsInSnapshots: true});

//Import scheduler modules here
csgo = require('./scheduler_modules/csgo');

//Initialize Schedulers
csgo(db, que, FieldValue);

// kue.app.listen(3000);