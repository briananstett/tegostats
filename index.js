const kue = require('kue');
const admin = require('firebase-admin');
const serviceAccount = require('./config/tegoesports-firebase-adminsdk-7vcjc-f7fe6375b6.json');

const que = kue.createQueue();

// Initialize Firebase
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const { FieldValue } = admin.firestore;
db.settings({ timestampsInSnapshots: true });

// Import scheduler modules here
const csgo = require('./scheduler_modules/csgo');

// Initialize Schedulers
csgo.start(db, que, FieldValue);

// kue web listener
kue.app.listen(3000);

process.once('SIGTERM', () => {
  // TODO (DEVELOPER) Need to wait for the jobs to finish to stop stale jobs
  console.log('Stopping...');
  console.log(csgo.stop(que));
  process.exit(0);
});

process.once('SIGINT', () => {
  que.activeCount((error, total) => {
    console.log('IN HERE');
    console.log(total);
    console.log(error);
  });
  console.log('Stopping...');
  console.log(csgo.stop(que));
  process.exit(0);
});
