const express = require('express');
const axios = require('axios');
const STEAM_API = require("./steamapi");
const cors = require("cors");
const hltb = require('howlongtobeat');
const mongoose = require('mongoose');

// connect to the database
mongoose.connect('mongodb://localhost:27017/steam', {
  useNewUrlParser: true
});

const gameSchema = new mongoose.Schema({
  appid: Number,
  steam: Object,
  hltb: Object,
});

const achievementSchema = new mongoose.Schema({
	appid: Number,
	users: Object,
	steamid: Number,
	playerstats: Object,
});

const Game = mongoose.model('Game', gameSchema);
const Achievement = mongoose.model('Achievement', achievementSchema);

const hltbService = new hltb.HowLongToBeatService();
const app = express();
app.use(cors());

const GAMES_URL = "http://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/";
const VANITY_URL = "http://api.steampowered.com/ISteamUser/ResolveVanityURL/v0001/";
const ACHIEVEMENTS_URL = "http://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v0001/";
const USER_URL = "http://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/";

let GAME_REQUEST = {
    key: STEAM_API.KEY,
    include_played_free_games: 1,
    include_appinfo: 1,
    format: 'json',
    steamid: "",
};

let VANITY_REQUEST = {
    key: STEAM_API.KEY,
    vanityurl: "",
};

let ACHIEVEMENTS_REQUEST = {
    key: STEAM_API.KEY,
    appid: "",
    steamid: ""
};

let USER_REQUEST = {
    key: STEAM_API.KEY,
    steamids: ""
};

app.get('/getSteamGames', function (req, res) {
    let request = GAME_REQUEST;
    request.steamid = req.query.steamid;
    axios.get(GAMES_URL, {params: request}).then(response => {
        res.send(response.data);
        response.data.response.games.forEach(game => {
        	dbAddGame(game);
        });
    }).catch(error => {
    	console.log(error)
        res.status(400);
        res.send(JSON.stringify(error, null, "\t"));
    });
})

app.get('/resolveVanity', function (req, res) {
    let request = VANITY_REQUEST;
    request.vanityurl = req.query.vanityurl;
    axios.get(VANITY_URL, {params: request}).then(response => {
        res.send(response.data);
    }).catch(error => {
        res.status(400);
        res.send(JSON.stringify(error, null, "\t"));
    });
})

app.get('/getUserProfile', function (req, res) {
    let request = USER_REQUEST;
    request.steamids = req.query.steamid;
    axios.get(USER_URL, {params: request}).then(response => {
        if (response.data.response.players.length == 0){
            res.status(400);
            res.send({
                user: {}
            })
            return
        }
        res.send({
            user: response.data.response.players[0]
        });
    }).catch(error => {
        res.status(400);
        res.send(JSON.stringify(error, null, "\t"));
    });
})

app.get('/getGameAchievements', async function (req, res) {
    let request = ACHIEVEMENTS_REQUEST;
    request.appid = req.query.appid;
    request.steamid = req.query.steamid;
    // Try checking DB cache first
    // try{
    // 	let a = await Achievement.findOne({appid: request.appid});
    // 	if (a[request.steamid]){
	   // 	res.send(a[request.steamid].playerstats);
	   // 	//console.log("a cache hit");
	   // 	return;
    // 	}
    // } catch (e){}
    // console.log("a cache miss " + request.appid);
    // Not in cache, fetch from Steam
    axios.get(ACHIEVEMENTS_URL, {params: request}).then(response => {
        res.send(response.data);
        //dbAddAchievements(request.appid, request.steamid, response.data.playerstats);
    }).catch(error => {
    	const fail = {
    		error: "Requested app has no stats",
    		success: false,
    		achievements: [],
    	};
        if (error.message == "Request failed with status code 400"){
            // No achievements
            res.send({
                playerstats: fail
            })
            //dbAddAchievements(request.appid, request.steamid, fail);
            return;
        }
        //dbAddAchievements(request.appid, request.steamid, fail);
        res.status(400);
        res.send(JSON.stringify(error, null, "\t"));
    });
})

app.get('/getHLTB', async function (req, res) {
    let game = req.query.game;
    let appid = req.query.appid;
    // Check DB cache first
    try{
    	let g = await Game.findOne({appid: appid});
    	if (Object.keys(g.hltb).length !== 0 || g.hltb.constructor !== Object){
    		res.send(g.hltb);
    		//console.log("h cache hit");
    		return;
    	}
    } catch(e){}
    //console.log("h cache miss");
    // Not in cache, fetch from hltb
    hltbService.search(game).then(result => {
		// HLTB matching sucks sometimes.
		// i.e.
		// 	query: "Dragon Quest V"
		// 	
		// 	result:
		// 		name: "Dragon Quest VI (1995)"
		// 			similarity: 64 
		// 		name: "Dragon Quest XI: Echoes of an Elusive Age"
		// 			similarity: 34
		// 		name: "Dragon Quest V: Hand of the Heavenly Bride"
		// 			similarity: 33
		// 
		// Result 0 is presumed a good matched cause it contains the full query with the fewest additional characters
		// Result 1 is presumed an ok match cause it contains the full query although not consecutively
		// Result 2 is presumed to be a worse match cause there are more additional characters than queried
		// No preference is given for a consecutive character match and extra characters are given too much negative weight
		// This code will look for STRONG matches and adjust similarity scores to order things more realistic to what we want
		result.forEach(match => {
			// Split name on space or : as that is common for subtitles
			// i.e
			// 	query: "Dragon Quest V"
			//
			// 	result:
			// 		name: "Dragon Quest VI (1995)"
			// 			<match>
			// 		name: "Dragon Quest XI: Echoes of an Elusive Age"
			//			<no  match>
			// 		name: "Dragon Quest V: Hand of the Heavenly Bride"
			// 			<strong match>
			//
			// Results 0 and 2 both contain the full query as a substring, but result 2 is a better match cause it doesn't cut the middle of a word
			let name = match.name.toLowerCase().split(/[\s\:]+/)
			let query = game.toLowerCase().split(/[\s\:]+/)
			if (query.every((i => v => i = name.indexOf(v, i) + 1)(0))){
				// Change score to just under 1 but multiple matches will still be in the same sorted order as HLTB matched
				// Score for name STARTING with query
				// 	0.9 < similarity <= 1 
				// Score for name otherwise containing query
				// 	0.8 < similarity < 0.9
				// i.e.
				// 	query: "Dragon Quest V"
				//
				// 	result:
				// 		name: "Dragon Quest VI (1995)"
				// 			similarity: 0.64
				// 				 => 0.64
				// 		name: "Dragon Quest XI: Echoes of an Elusive Age"
				//			similarity: 0.34
				//				 => 0.34
				// 		name: "Dragon Quest V: Hand of the Heavenly Bride"
				// 			similarity: 0.33
				// 				 => 0.933
				//
				// 	query: "Mother"
				// 	
				// 	result:
				// 		name: "Mother"
				// 			similarity: 1
				// 				 => 1
				// 		name: "Mother 3"
				// 			similarity: 0.75
				// 				 => 0.975
				// 		name: "Touhou MOTHER"
				// 			similarity: 0.46
				// 				 => 0.856
				match.similarity = 0.8 + (match.similarity / 10)
				if (match.name.toLowerCase().startsWith(game.toLowerCase())){
					match.similarity += 0.1
				}
			}
			// String match but no strong match
			else if (match.name.toLowerCase().includes(game.toLowerCase())){
				match.similarity
			}
			// If there's no match, similarity score should be less than 0.8
			else {
				match.similarity *= 0.8
			}
		})
		// Sort by similarity score
		result.sort((a, b) => {
			if (a.similarity == b.similarity){
				return a.name.localeCompare(b.name)
			}
			return b.similarity - a.similarity
		})
		if (result.length < 1){
		    res.send({})
		    dbAddHLTB(appid, {empty: true});
		    return;
		}
		res.send(result[0]);
		dbAddHLTB(appid, result[0]);
	});
})

let server = app.listen(4202, function () {
    console.log("Example app listening at http://%s:%s", server.address().address, server.address().port)
})


async function dbAddGame(steam){
	const game = new Game({
		appid: steam.appid,
		steam: steam,
		hltb: {},
	});
	try{
		await game.save();
	} catch (e){
		//console.log(e);
	}
}

async function dbAddHLTB(appid, hltb){
	try{
		let game = await Game.findOne({appid: appid});
		game.hltb = hltb;
		await game.save();
	} catch (e){console.log(e)}
}

// async function dbAddAchievements(appid, steamid, playerstats){
// 	try{
// 		let a = await Achievement.findOne({appid: appid});
// 		a.users[steamid] = playerstats;
// 		await a.save();
// 	} catch (e){
// 		const a = new Achievement({
// 			appid: appid,
// 			users: {
// 				[steamid]: playerstats
// 			},
// 		});
// 		try{
// 			await a.save();
// 		} catch (e) {}
// 	}
// }