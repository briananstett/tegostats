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
        

        accuracy(stats, savedStats);
        headShots(stats, savedStats);
        winRate(stats, savedStats);
        killDeath(stats,savedStats)
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

    let accuracy = Math.floor((shotsHit / shotsFired) *100 );
    
    save.accuracyPercent = accuracy;
}

/**
 * Percentage of headshots
 * @param {object} stats JSON object of raw stats.
 * @param {object} save JSON object to pusha saved status
 */
function headShots(stats, save){
    let shotshit = stats.total_shots_hit.value;
    let headshots = stats.total_kills_headshot.value;

    let headshotPercent = Math.floor((headshots/shotshit) * 100);
    
    save.headshotPercent = headshotPercent;
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

    let winRate = Math.floor((wins/totalRounds) * 100);
    save.winRate = winRate;
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

    let kdRatio = Math.floor((kills/deaths) * 100);
    save.kdRatio = kdRatio;
}


queue.process('csgo', concurrency, function(message, done){
    let steamID = message.data.steamID;
    let userID = message.data.userID;
    let requestURI = `http://api.steampowered.com/ISteamUserStats/GetUserStatsForGame/v0001/?appid=${gameID}&key=${apiKey}&steamid=${steamID}`;
    rp({
        uri: requestURI
    }).then((csgoStats=>{
        // console.log(csgoStats)
        parser(csgoStats)
            .then(savedStates=>{
                //update cloud store
                console.log(savedStates);
                done();
            }).catch(error=>{
                done(error);
            });
    })).catch(error=>{
        //Request failed
        console.log('DEBUG',error);
        let requestError = new Error("Bad Request")
            requestError.URI = requestURI;
            requestError.userID = userID;
        done(requestError);
    });
    
});





