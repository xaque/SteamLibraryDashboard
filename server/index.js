let express = require('express');
const axios = require('axios');
const STEAM_API = require("./steamapi");
const cors = require("cors");

const app = express();
app.use(cors());

const GAMES_URL = "http://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/";
const VANITY_URL = "http://api.steampowered.com/ISteamUser/ResolveVanityURL/v0001/";

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

app.get('/getSteamGames', function (req, res) {
    let request = GAME_REQUEST;
    request.steamid = req.query.steamid;
    axios.get(GAMES_URL, {params: request}).then(response => {
        res.send(response.data);
    }).catch(error => {
        res.end(JSON.stringify(error, null, "\t"));
    });
})

app.get('/resolveVanity', function (req, res) {
    let request = VANITY_REQUEST;
    request.vanityurl = req.query.vanityurl;
    axios.get(VANITY_URL, {params: request}).then(response => {
        res.send(response.data);
    }).catch(error => {
        res.end(JSON.stringify(error, null, "\t"));
    });
})

let server = app.listen(4200, function () {
    console.log("Example app listening at http://%s:%s", server.address().address, server.address().port)
})