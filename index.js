var kue= require('kue'),
    que= kue.createQueue();


var job = que.create('csgo',{
    steamID: "76561198037475921",
    userID: '4'
}).removeOnComplete(true).save(error=>{
    if(error) console.log(error);
    console.log(job.id);
})   


kue.app.listen(3000);