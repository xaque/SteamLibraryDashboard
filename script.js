let app = new Vue({
  el: '#app',
  data: {
      vanityurl: "",
      userNotFound: false,
      steamid: "",
      validid: false,
      profilePrivate: false,
      games: [],
      numGames: 0,
      sortedBy: "title",
      achievementData: {},
  },
  computed: {
  },
  watch: {
  },
  methods: {
      async userSubmit() {
          try {
              this.profilePrivate = false
              this.games = []
              this.numGames = 0
              const response = await axios.get("http://xaque.net:4200/resolveVanity?vanityurl=" + this.vanityurl)
              let success = response.data.response.success
              if (success != 1){
                  //TODO Something
                  this.steamid = ""
                  this.validid = false
                  this.userNotFound = true
                  return
              }
              this.userNotFound = false
              this.validid = true
              this.steamid = response.data.response.steamid
          }
          catch(error) {
              this.userNotFound = false
              this.validid = false
              this.steamid = ""
              console.log(error)
          }
      },
      async gamesSubmit() {
          try {
              const response = await axios.get("http://xaque.net:4200/getSteamGames?steamid=" + this.steamid)
              if (Object.entries(response.data.response).length === 0 && response.data.response.constructor === Object){
                  this.profilePrivate = true
                  return;
              }
              this.profilePrivate = false
              this.numGames = response.data.response.game_count
              this.games = response.data.response.games.sort((a, b) => a.name.localeCompare(b.name))
              this.sortedBy = "title"
              let promises = this.games.map(game => this.getAchievements(game.appid))
              Promise.all(promises).then(values => {
                  this.$forceUpdate()
              })
              // this.games.forEach(game => {
              //     this.getAchievements(game.appid)
              // })
          }
          catch(error) {
              //this.profilePrivate = true
              console.log(error)
          }
      },
      async getAchievements(appid) {
          appid = appid.toString()
          try {
              const response = await axios.get("http://xaque.net:4200/getGameAchievements?steamid=" + this.steamid + "&appid=" + appid)
              if (response.data.playerstats.success == false){
                  this.achievementData[appid] = [{
                      apiname: "NoAchievements",
                      achieved: 0,
                      unlocktime: 0
                  }]
                  return
              }
              if (response.data.playerstats.achievements == undefined){
                  //Game has no achievements
                  return
              }
              this.achievementData[appid] = Object.values(response.data.playerstats.achievements)
              //this.$forceUpdate()
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
  }
});