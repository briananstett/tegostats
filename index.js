var kue= require('kue'),
    que= kue.createQueue();


var job = que.create('csgo',{
    // steamID: "76561198037475921",
    steamID: '76561198099273779',
    userID: '881a812d-b23a-4cb7-9e5e-c1873da6c1f9'
}).removeOnComplete(true).save(error=>{
    if(error) console.log(error);
    console.log(job.id);
})   

kue.app.listen(3000);