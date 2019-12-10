let app = new Vue({
    el: '#app',
    data: {
        vanityurl: "",
        userNotFound: false,
        steamid: "",
        validid: false,
        profilePrivate: false,
        profileRetrieved: false,
        user: {},
        games: [],
        sortedBy: "title",
    },
    computed: {
        numGames() {
            return this.games.length
        }
    },
    methods: {
        async userSubmit() {
            try {
                const response = await axios.get("http://xaque.net:4202/resolveVanity?vanityurl=" + this.vanityurl)
                this.clearUserData()
                if (response.data.response.success != 1){
                    this.userNotFound = true
                    return
                }
                this.validid = true
                this.steamid = response.data.response.steamid
            }
            catch(error) {
                console.log(error)
            }
        },
        async getUser() {
            try {
                const response = await axios.get("http://xaque.net:4202/getUserProfile?steamid=" + this.steamid)
                this.user = response.data.user
                this.profileRetrieved = true;
            }
            catch(error) {
                console.log(error)
            }
        },
        async gamesSubmit() {
            await this.userSubmit()
            if (!this.validid){
                return
            }
            this.getUser()
            try {
                const response = await axios.get("http://xaque.net:4202/getSteamGames?steamid=" + this.steamid)
                if (Object.entries(response.data.response).length === 0 && response.data.response.constructor === Object){
                    this.profilePrivate = true
                    return;
                }
                this.profilePrivate = false
                let games = response.data.response.games.sort((a, b) => a.name.localeCompare(b.name))
                this.sortedBy = "title"
                games.forEach(game => {
                    game.hltb = "loading..."
                    game.percentComplete = "loading..."
                    this.getHLTB(game)
                    this.getAchievements(game)
                })
                this.games = games
            }
            catch(error) {
                console.log(error)
            }
        },
        async getAchievements(game) {
            let appid = game.appid.toString()
            try {
                const response = await axios.get("http://xaque.net:4202/getGameAchievements?steamid=" + this.steamid + "&appid=" + appid)
                if (response.data.playerstats.success == false || response.data.playerstats.achievements == undefined){
                    game.achievements = []
                    game.percentComplete = "--"
                    return
                }
                game.achievements = Object.values(response.data.playerstats.achievements)
                let total = game.achievements.length
                let achieved = game.achievements.filter(achievement => achievement.achieved == 1).length
                game.percentComplete = (achieved / total * 100).toLocaleString('en-US', {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 2
                });
            }
            catch(error) {
                console.log(error)
            }
        },
        sort(by) {
            if (this.sortedBy == by){
                this.games.reverse()
                return
            }
            if (by == "title"){
                this.games.sort((a,b) => a.name.localeCompare(b.name))
            }
            else if (by == "playtime"){
                this.games.sort((a,b) => b.playtime_forever - a.playtime_forever)
            }
            else if (by == "achievments"){
                this.games.sort((a,b) => {
                    let apc = a.percentComplete
                    let bpc = b.percentComplete
                    if (!(apc >= 0)){
                        apc = -1
                    }
                    if (!(bpc >= 0)){
                        bpc = -1
                    }
                    return bpc - apc
                })
            }
            else if (by == "hltb"){
                this.games.sort((a,b) => {
                    let apc = a.hltb
                    let bpc = b.hltb
                    if (!(apc >= 0)){
                        apc = -1
                    }
                    if (!(bpc >= 0)){
                        bpc = -1
                    }
                    return bpc - apc
                })
            }
            else{
                this.games.sort((a,b) => b[by] - a[by])
            }
            this.sortedBy = by
        },
        async getHLTB(game){
            try {
                //Remove registered and trademark symbols from the title
                //Replace semicolons with &amp;
                let searchName = game.name.replace(/[™]/g, " ").replace(/[®]/g, " ").replace(/[;]/g, "&amp;")
                let response = await axios.get("http://xaque.net:4202/getHLTB?game=" + searchName + "&appid=" + game.appid)
                let playtime = response.data.gameplayMainExtra
                if (playtime != undefined){
                    game.hltbid = response.data.id
                    game.hltb = playtime
                    return
                }
                
                // No result found so try altering the search
                
                if (searchName.includes("/")){
                    // "Resident Evil 0 / biohazard 0" becomes "Resident Evil 0"
                    searchName = searchName.split("/")[0]
                }
                // Remove parentheses from title
                else if (searchName.includes("(")){
                    searchName = searchName.split("(")[0] + searchName.split(")")[1]
                }
                // Remove edition from title
                else if (searchName.toLowerCase().includes("edition")){
                    // Remove "Edition" and preceding word
                    let newName = []
                    for (let word of searchName.toLowerCase().split(" ")){
                        if (word.includes("edition")){
                            newName.pop()
                            break;
                        }
                        newName.push(word)
                    }
                    // Remove any trailing punctuation
                    searchName = newName.join(" ").trim()
                    if (searchName.endsWith(":") || searchName.endsWith("-")){
                        searchName = searchName.slice(0, -1);
                    }
                }
                // Remove subtitles
                else if (searchName.includes(":")){
                    searchName = searchName.split(":")[0]
                }
                else if (searchName.includes("-")){
                    searchName = searchName.split("-")[0]
                }
                // Remove remastered
                else if (searchName.toLowerCase().includes("remastered")){
                    searchName = searchName.toLowerCase().replace("remastered", "")
                }
                // Remove misc special characters
                else {
                    searchName = searchName.replace(/[^a-zA-Z0-9.()!?@#$%^&*; ]/g, " ")
                }
                // Remove elipsis
                searchName = searchName.replace(/[(...)]/g, " ")
                // Remove dash and colon
                searchName = searchName.replace(/[-:]/g, " ")
                // Try the search again
                response = await axios.get("http://xaque.net:4202/getHLTB?game=" + searchName + "&appid=" + game.appid)
                playtime = response.data.gameplayMainExtra
                if (playtime == undefined){
                    game.hltbid = ""
                    playtime = "--"
                }
                game.hltb = playtime
                game.hltbid = response.data.id
            }
            catch(error) {
                console.log(error)
            }
        },
        clearUserData() {
            this.userNotFound = false
            this.steamid = ""
            this.validid = false
            this.profilePrivate = false
            this.games = []
            this.user = {}
            this.profileRetrieved = false;
        }
    }
});