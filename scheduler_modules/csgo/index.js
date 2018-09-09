/**
 *
 * @param {Firestore instances} db Firestore instance
 * @param {Kue job Queue} que A Kue job Queue instance
 * @param {Firestore Timestamp} Timestamp Firestore Timestamp object
 */
let scheduleInterval;

function addMessage(db, que, FieldValue) {
  // Query for all schedule tasks that have the status ready and are healthy
  db.collection('schedule')
    .doc('csgo')
    .collection('tasks')
    .where('status', '==', 'ready')
    .where('health', '==', 'healthy')
    .orderBy('timestamp', 'asc')
    .limit(1)
    .get()
    .then(querySnapshot => {
      if (!querySnapshot.empty) {
        // If was a found valid schedule task, add it to the que

        // Get the data and documentReference from task
        const queryDocumentSnapshot = querySnapshot.docs[0];
        const documentReference = queryDocumentSnapshot.ref;
        const scheduleTaskData = queryDocumentSnapshot.data();

        // Update status and timestamp
        documentReference.update({
          status: 'pulling',
          timestamp: FieldValue.serverTimestamp()
        });

        // Create new message
        const job = que
          .create('csgo', {
            steam_id: scheduleTaskData.steam_id,
            user_id: scheduleTaskData.user.id,
            userReference: scheduleTaskData.user
          })
          .removeOnComplete(true)
          .save();

        // Message completed successfully
        job
          .on('complete', result => {
            console.log('success', result);
            documentReference.update({
              status: 'ready',
              timestamp: FieldValue.serverTimestamp()
            });
          })
          // Message failed all attempts
          .on('failed', errorMessage => {
            console.log('error', errorMessage);
            // Change the task status to unhealthy
            documentReference.update({
              health: 'unhealthy',
              status: 'ready'
            });
          });
      }
    })
    .catch(error => {
      console.log(error);
    });
}

// Global interval
module.exports.start = (db, que, FieldValue) => {
  // Steam API supports 100,000 requests a day ~ 1.157 RPS
  console.log('CSGO Schedule Interval has Started');
  scheduleInterval = setInterval(addMessage, 1157, db, que, FieldValue);
};

module.exports.stop = que => {
  console.log('CSGO Schedule Interval has Stopped');
  clearInterval(scheduleInterval);
  console.log('here');
  que.activeCount((error, total) => {
    console.log('here two');
    console.log(error);
    console.log(total);
    if (total) console.log(`There are still ${total} active jobs`);
    else return true;
  });
};
