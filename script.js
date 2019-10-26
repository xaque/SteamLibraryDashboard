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
      achievementData: {},
  },
  computed: {
    numGames() {
      return this.games.length
    }
  },
  methods: {
      async userSubmit() {
          try {
              const response = await axios.get("http://xaque.net:4200/resolveVanity?vanityurl=" + this.vanityurl)
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
              const response = await axios.get("http://xaque.net:4200/getUserProfile?steamid=" + this.steamid)
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
              const response = await axios.get("http://xaque.net:4200/getSteamGames?steamid=" + this.steamid)
              if (Object.entries(response.data.response).length === 0 && response.data.response.constructor === Object){
                  this.profilePrivate = true
                  return;
              }
              this.profilePrivate = false
              this.games = response.data.response.games.sort((a, b) => a.name.localeCompare(b.name))
              this.sortedBy = "title"
              let promises = this.games.map(game => this.getAchievements(game.appid))
              Promise.all(promises).then(values => {
                  this.$forceUpdate()
              })
          }
          catch(error) {
              console.log(error)
          }
      },
      async getAchievements(appid) {
          appid = appid.toString()
          try {
              const response = await axios.get("http://xaque.net:4200/getGameAchievements?steamid=" + this.steamid + "&appid=" + appid)
              if (response.data.playerstats.success == false || response.data.playerstats.achievements == undefined){
                  this.achievementData[appid] = [{
                      apiname: "NoAchievements",
                      achieved: 0,
                      unlocktime: 0
                  }]
                  return
              }
              this.achievementData[appid] = Object.values(response.data.playerstats.achievements)
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
              this.games.sort((a,b) => this.percentComplete(b.appid) - this.percentComplete(a.appid))
          }
          else{
              this.games.sort((a,b) => b[by] - a[by])
          }
          this.sortedBy = by
      },
      percentComplete(appid) {
          appid = appid.toString()
          if (this.achievementData[appid] == undefined){
              return "loading"
          }
          appid = appid.toString()
          let total = this.achievementData[appid].length
          let achieved = this.achievementData[appid].filter(achievement => achievement.achieved == 1).length
          return achieved / total * 100
      },
      clearUserData() {
          this.userNotFound = false
          this.steamid = ""
          this.validid = false
          this.profilePrivate = false
          this.games = []
          this.achievementData = {}
          this.user = {}
          this.profileRetrieved = false;
      }
  }
});