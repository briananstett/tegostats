/**
 * @description
 * TeGo stat worker for Counter Strike Global Offensive. Listens on que 'csgo' for
 * message requests.Each request makes a REST api call to Steam for CSGO stats, parses them,
 * and updates the user's information in CloudStore.
 *
 * @author Brian Anstett
 */

const kue = require('kue');
const rp = require('request-promise');
const async = require('async');
const admin = require('firebase-admin');

const queue = kue.createQueue();

// Configuration
const configuration = require('../config/config.json');
const serviceAccount = require('../config/tegoesports-firebase-adminsdk-7vcjc-f7fe6375b6.json');

const { gameID, concurrency } = configuration;
const apiKey = configuration.steamKey;

// Initialize Firebase
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();
db.settings({ timestampsInSnapshots: true });

// Functions
/**
 * Shot accuracy
 * @param {object} stats JSON object of raw stats.
 * @param {object} save JSON object to pusha saved status
 */
function accuracy(stats, save) {
  const saveObject = save;
  const shotsFired = stats.total_shots_fired.value;
  const shotsHit = stats.total_shots_hit.value;
  const accuracyValue = ((shotsHit / shotsFired) * 100).toPrecision(3);

  saveObject.accuracy = Number(accuracyValue);
}

/**
 * Percentage of headshots
 * @param {object} stats JSON object of raw stats.
 * @param {object} save JSON object to pusha saved status
 */
function headShots(stats, save) {
  const saveObject = save;
  const shotshit = stats.total_kills.value;
  const headshots = stats.total_kills_headshot.value;
  const headshotPercent = ((headshots / shotshit) * 100).toPrecision(3);

  saveObject.headshotPercent = Number(headshotPercent);
  saveObject.headshots = headshots;
}

/**
 * win rate
 * @param {object} stats JSON object of raw stats.
 * @param {object} save JSON object to pusha saved status
 * @description Calculates the win and loose rate of the player
 */
function winRate(stats, save) {
  const saveObject = save;
  const wins = stats.total_wins.value;
  const totalRounds = stats.total_rounds_played.value;
  const winRateValue = ((wins / totalRounds) * 100).toPrecision(3);

  saveObject.winRate = Number(winRateValue);
  saveObject.totalRounds = totalRounds;
  saveObject.totalRoundsWon = wins;
}

/**
 * Kill/Death ratio
 * @param {object} stats JSON object of raw stats.
 * @param {object} save JSON object to pusha saved status
 * @description Calculates the Kill Death ratio
 */
function killDeath(stats, save) {
  const saveObject = save;
  console.log(stats.total_kills);
  const kills = stats.total_kills.value;
  const deaths = stats.total_deaths.value;
  const kdRatio = (kills / deaths).toPrecision(3);

  saveObject.kdRatio = Number(kdRatio);
}

/**
 * @function timeStemp
 * @param {object} save JSON object to pusha saved status
 */
function timestamp(save) {
  const saveObject = save;
  saveObject.timestamp = Date.now();
}

/**
 * One offs stats.
 * @param {object} stats JSON object of raw stats.
 * @param {object} save JSON object to push save status
 * @description Add single one-off stats
 */
function misStats(stats, save) {
  const saveObject = save;
  const bombPlanted = stats.total_planted_bombs.value;
  const bombDefused = stats.total_defused_bombs.value;
  const timePlayed = Math.floor(stats.total_time_played.value / 3600);
  const ADR = Math.floor(stats.total_damage_done.value / stats.total_rounds_played.value);
  const pistolWin = Number(
    (
      (stats.total_wins_pistolround.value / (stats.total_matches_played.value * 2)) *
      100
    ).toPrecision(3)
  );

  const knifeKills = stats.total_kills_knife.value;
  const zeusKills = stats.total_kills_taser.value;
  const totalMoney = stats.total_money_earned.value.toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,');
  const mvp = stats.total_mvps.value;
  const totalKills = stats.total_kills.value;
  const totalDeaths = stats.total_deaths.value;
  const totalDamage = stats.total_damage_done.value;
  const totalMatches = stats.total_matches_played.value;
  const totalMatchesWon = stats.total_matches_won.value;
  const weaponsGivenToTeam = stats.total_weapons_donated.value;

  saveObject.bombPlanted = bombPlanted;
  saveObject.bombDefused = bombDefused;
  saveObject.timePlayed = timePlayed;
  saveObject.ADR = ADR;
  saveObject.pistolWin = pistolWin;
  saveObject.knifeKills = knifeKills;
  saveObject.zeusKills = zeusKills;
  saveObject.totalMoney = totalMoney;
  saveObject.mvp = mvp;
  saveObject.totalKills = totalKills;
  saveObject.totalDeaths = totalDeaths;
  saveObject.totalDamage = totalDamage;
  saveObject.totalMatches = totalMatches;
  saveObject.totalMatchesWon = totalMatchesWon;
  saveObject.totalWeaponsGiven = weaponsGivenToTeam;
}

/**
 * @function gunStats
 * @param {object} stats JSON object of raw stats.
 * @param {object} save JSON object to push save status
 * @description retrieves mis. run stats
 */
function gunStats(stats, save) {
  const saveObject = save;
  const farmerBrown = stats.total_kills_sawedoff.value;
  const brownAccuracy = (
    (stats.total_hits_sawedoff.value / stats.total_shots_sawedoff.value) *
    100
  ).toPrecision(3);
  const deagle = stats.total_kills_deagle.value;
  const deagleAccuracy = (
    (stats.total_hits_deagle.value / stats.total_shots_deagle.value) *
    100
  ).toPrecision(3);
  const awpKills = stats.total_kills_awp.value;
  const awpAccuracy = (
    (stats.total_hits_awp.value / stats.total_shots_awp.value) *
    100
  ).toPrecision(3);

  saveObject.farmerBrown = farmerBrown;
  saveObject.brownAccuracy = brownAccuracy;
  saveObject.deagleKills = deagle;
  saveObject.deagleAccuracy = deagleAccuracy;
  saveObject.awpKills = awpKills;
  saveObject.awpAccuracy = awpAccuracy;
}

function historicKDR(rawStats) {
  const { stats } = JSON.parse(rawStats).playerstats;
  console.log(stats.total_kills);
  const kills = stats.total_kills.value;
  const deaths = stats.total_deaths.value;
  const kdRatio = (kills / deaths).toPrecision(3);

  return kdRatio;
}
// support functions
/**
 * Head function that handles all parsing of stat data
 * @param {object} rawStats Stringified verstion CSGO stats
 * @return {promise}
 */
function parser(rawStats) {
  return new Promise((resolve, reject) => {
    const savedStats = {};
    const { stats } = JSON.parse(rawStats).playerstats;

    async.each(
      [accuracy, headShots, winRate, killDeath, misStats, gunStats, timestamp],
      (getStat, callback) => {
        getStat(stats, savedStats);
        callback(err => {
          if (err) {
            reject(err);
          }
        });
      }
    );
    return resolve(savedStats);
    // TODO(Developer) Please find a better way to do this
  });
}

// Processor
console.log('Counter Strike Stats Worker');
queue.process('csgo', concurrency, (message, done) => {
  const steamID = message.data.steam_id;
  const userID = message.data.user_id;
  const { userReference } = message.data;
  console.log(steamID, userID);
  const requestURI = `http://api.steampowered.com/ISteamUserStats/GetUserStatsForGame/v0001/?appid=${gameID}&key=${apiKey}&steamid=${steamID}`;
  rp({
    uri: requestURI
  })
    .then(async csgoStats => {
      // let fs = require('fs');
      // fs.writeFileSync(csgoStats, 'temp.json');
      try {
        // TODO (DEVELOPER) Promise all, get user limits and parser stats
        const kdr = historicKDR(csgoStats);
        const saveStats = await parser(csgoStats);
        await db
          .collection('csgo')
          .doc(userID)
          .set(saveStats);
        db.collection('csgo')
          .doc(userID)
          .collection('historicKDR')
          .add({
            kdr,
            timestamp: Date.now()
          });
        done();
      } catch (error) {
        console.log(error);
        done(error);
      }
    })
    .catch(error => {
      // Request failed
      console.error('DEBUG', error);
      const requestError = new Error('Bad Request');
      requestError.URI = requestURI;
      requestError.userID = userID;
      // update health of this request (healthy, unhealthy, error)
      done(requestError);
    });
});

process.once('SIGTERM', () => {
  queue.shutdown(5000, err => {
    console.log('Kue shutdown: ', err || '');
    process.exit(0);
  });
});

process.once('SIGINT', () => {
  queue.shutdown(5000, err => {
    console.log('Kue shutdown: ', err || '');
    process.exit(0);
  });
});
