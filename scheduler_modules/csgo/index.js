/**
 * 
 * @param {Firestore instances} db Firestore instance
 * @param {Kue job Queue} que A Kue job Queue instance
 * @param {Firestore Timestamp} Timestamp Firestore Timestamp object
 */
function addMessage(db, que, FieldValue){
    //Query for all schedule tasks that have the status ready and are healthy
    db.collection('schedule').doc('csgo').collection('tasks')
        .where('status', '==', 'ready')
        .where('health', '==', 'healthy')
        .orderBy('timestamp', 'asc')
        .limit(1).get()
            .then(querySnapshot=>{
                if(!querySnapshot.empty){
                    //If was a found valid schedule task, add it to the que

                    //Get the data and documentReference from task
                    let queryDocumentSnapshot = querySnapshot.docs[0];
                    let documentReference = queryDocumentSnapshot.ref;
                    let scheduleTaskData = queryDocumentSnapshot.data();

                    //Update status and timestamp
                    documentReference.update({
                        status: 'pulling',
                        timestamp: FieldValue.serverTimestamp()
                    })

                    //Create new message
                    var job = que.create('csgo',{
                        steam_id: scheduleTaskData.steam_id,
                        user_id: scheduleTaskData.user_id
                    }).removeOnComplete(true).save()

                    //Message completed successfully
                    job.on('complate', (result=>{
                        console.log("success", result);
                        //update status to ready
                    }))
                    //Message failed all attempts
                    .on('failed', errorMessage=>{
                        console.log("error", errorMessage)
                        //Change the task status to unhealthy
                        documentReference.update({
                            health: 'unhealthy'
                        })
                    })
                }
            })
            .catch(error=>{
                console.log(error);
            })   
}


module.exports = function (db,que, FieldValue){
    //Steam API supports 100,000 requests a day ~ 1.157 RPS
    setInterval(addMessage,1157, db, que, FieldValue);
}