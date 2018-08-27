/**
 * @description 
 * TeGo stat worker for Counter Strike Global Offensive. Listens on que 'csgo' for
 * message requests.Each request makes a REST api call to Steam for CSGO stats, parses them,
 * and updates the user's information in CloudStore.
 * 
 * @author Brian Anstett
 */
const kue = require('kue');
const queue = kue.createQueue();
const rp = require('request-promise');
const fs = require('fs');
const async = require('async');
const admin = require('firebase-admin');

//Configuration
const configuration = require('../config/config.json');
const serviceAccount = require('../config/tegoesports-firebase-adminsdk-7vcjc-f7fe6375b6.json');
const gameID = configuration.gameID;
const apiKey = configuration.steamKey;
const concurrency = configuration.concurrency;

//Initialize Firebase
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});
var db = admin.firestore();
db.settings({timestampsInSnapshots: true});

//support functions
/**
 * Head function that handles all parsing of stat data
 * @param {object} rawStats Stringified verstion CSGO stats
 * @return {promise}
 */
function parser(rawStats){
    return new Promise((resolve, reject)=>{
        let savedStats = {};
        var stats = JSON.parse(rawStats).playerstats.stats;
        
        async.each([accuracy, headShots, winRate, killDeath, misStats], (getStat,callback)=>{
            getStat(stats,savedStats);
            callback();
        })
        return resolve(savedStats);
        //TODO(Developer) Please find a better way to do this
    })

}

/**
 * Shot accuracy
 * @param {object} stats JSON object of raw stats.
 * @param {object} save JSON object to pusha saved status
 */
function accuracy(stats, save){
    let shotsFired = stats.total_shots_fired.value;
    let shotsHit = stats.total_shots_hit.value;

    let accuracy = ((shotsHit / shotsFired)* 100).toPrecision(3);
    
    save.accuracyPercent = Number(accuracy);
}

/**
 * Percentage of headshots
 * @param {object} stats JSON object of raw stats.
 * @param {object} save JSON object to pusha saved status
 */
function headShots(stats, save){
    let shotshit = stats.total_kills.value;
    let headshots = stats.total_kills_headshot.value;

    let headshotPercent =((headshots/shotshit) * 100).toPrecision(3);
    
    save.headshotPercent = Number(headshotPercent);
}

/**
 * win rate
 * @param {object} stats JSON object of raw stats.
 * @param {object} save JSON object to pusha saved status
 * @description Calculates the win and loose rate of the player
 */
function winRate(stats, save){
    let wins = stats.total_wins.value;
    let totalRounds = stats.total_rounds_played.value;

    let winRate = ((wins/totalRounds) * 100).toPrecision(3);
    save.winRate = Number(winRate);
}

/**
 * Kill/Death ratio
 * @param {object} stats JSON object of raw stats.
 * @param {object} save JSON object to pusha saved status
 * @description Calculates the Kill Death ratio
 */
function killDeath(stats, save){
    let kills = stats.total_kills.value;
    let deaths = stats.total_deaths.value;

    let kdRatio = ((kills/deaths)).toPrecision(3);
    save.kdRatio = Number(kdRatio);
}

/**
 * One offs stats. 
 * @param {object} stats JSON object of raw stats.
 * @param {object} save JSON object to push save status
 * @description Add single one-off stats
 */
function misStats(stats, save){
    let bombPlanted = stats.total_planted_bombs.value;
    let bombDefused = stats.total_defused_bombs.value;
    let timePlayed = Math.floor(stats.total_time_played.value /3600);
    let averageDMG = Math.floor(stats.total_damage_done.value/stats.total_rounds_played.value);
    let pistolWin = Number(((stats.total_wins_pistolround.value/(stats.total_matches_played.value * 2))*100).toPrecision(3));
    let knifeKills = stats.total_kills_knife.value;

    save.bombPlanted = bombPlanted;
    save.bombDefused = bombDefused;
    save.timePlayed = timePlayed;
    save.averageDMGHP = averageDMG;
    save.pistolWin = pistolWin;
    save.knifeKills = knifeKills;


}

console.log("Counter Strike Stats Worker");
queue.process('csgo', concurrency, function(message, done){
    let steamID = message.data.steam_id;
    let userID = message.data.user_id;
    let requestURI = `http://api.steampowered.com/ISteamUserStats/GetUserStatsForGame/v0001/?appid=${gameID}&key=${apiKey}&steamid=${steamID}`;
    rp({
        uri: requestURI
    }).then((csgoStats=>{
        // let fs = require('fs');
        // fs.writeFileSync(csgoStats, 'temp.json');
        parser(csgoStats)
            .then(savedStates=>{
                //update cloud store
                console.log(savedStates);
                db.collection('csgo').doc(userID).set(savedStates)
                    .then(success=>{
                        done();    
                    })
                    .catch(error=>{
                        done(error)
                    })
            }).catch(error=>{
                console.log(error);
                done(error);
            });
    })).catch(error=>{
        //Request failed
        console.log('DEBUG',error);
        let requestError = new Error("Bad Request")
            requestError.URI = requestURI;
            requestError.userID = userID;
        //update health of this request (healthy, unhealthy, error)
        done(requestError);
    });
    
});

process.once( 'SIGTERM', function ( sig ) {
    queue.shutdown( 5000, function(err) {
      console.log( 'Kue shutdown: ', err||'' );
      process.exit( 0 );
    });
  });

  process.once( 'SIGINT', function ( sig ) {
    queue.shutdown( 5000, function(err) {
      console.log( 'Kue shutdown: ', err||'' );
      process.exit( 0 );
    });
  });





