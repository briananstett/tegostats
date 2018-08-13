/**
 * @description 
 * TeGo stat worker for Counter Strike Global Offensive. Listens on que 'csgo' for
 * messages requests.Each request make a REST api call to Steam for CSGO stats, parses them,
 * and updates the user's information in CloudStore.
 * 
 * @author Brian Anstett
 */
const kue = require('kue');
const queue = kue.createQueue();
const rp = require('request-promise');

//Configuration
const configuration = require('./config.json');
const gameID = configuration.gameID;
const apiKey = configuration.steamKey;
const concurrency = configuration.concurrency;


queue.process('csgo', concurrency, function(message, done){
    let steamID = message.data.steamID;
    let userID = message.data.userID;
    let requestURI = `http://api.steampowered.com/ISteamUserStats/GetUserStatsForGame/v0001/?appid=${gameID}&key=${apiKey}&steamid=${steamID}`;
    rp({
        uri: requestURI
    }).then((csgoStats=>{
        console.log(csgoStats)
        done();
        //TODO(Developer) process data and add to cloudStore
    })).catch(error=>{
        //Request failed
        console.log(error.response.statusCode);
        let requestError = new Error("Bad Request")
            requestError.URI = requestURI;
            requestError.userID = userID;
        done(requestError);
    });
    
});


