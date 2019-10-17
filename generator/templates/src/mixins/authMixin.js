import { mapState, mapGetters } from 'vuex'

export default {
  computed: {
    ...mapState({
      authStatus: state => state.auth.status,
      profile: state => state.auth.profile, // profile from jwt token
      user: state => state.auth.user // user account from db
    }),
    ...mapGetters(['hasAuthenticated', 'isAuthenticated']),
    userId () {
      return (this.user && this.user.id) || 0
    }
  },

  watch: {
    user (user) {
      if (!user.id) {
        return
      }
      if (typeof this.onAuthUserFound === 'function') {
        this.onAuthUserFound()
      }
    }
  },
  methods: {
    login () {
      this.$store.dispatch('login')
    },

    logout () {
      this.$store.dispatch('logout')
    }
  }
}
