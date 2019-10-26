let app = new Vue({
  el: '#app',
  data: {
      vanityurl: "",
      userNotFound: false,
      steamid: "",
      validid: false,
      profilePrivate: false,
      games: []
  },
  created() {
  },
  computed: {
  },
  watch: {
  },
  methods: {
      async userSubmit() {
          try {
              this.profilePrivate = false
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
              this.games = response.data.response.games
          }
          catch(error) {
              //this.profilePrivate = true
              console.log(error)
          }
      }
  }
});