import { mapState, mapGetters } from 'vuex'
import gql from 'graphql-tag'

export default {
  data () {
    return {
      dbUser: {}
    }
  },
  created () {
    if (this.$route.name !== 'callback') {
      if (this.hasAuthenticated && !this.isAuthenticated) {
        this.$store.dispatch('renewTokens')
      } else {
        this.$store.dispatch('renewalAttempted')
      }
    }
  },
  computed: {
    ...mapState({
      authStatus: state => state.auth.status,
      profile: state => state.auth.profile, // profile from jwt token
      user: state => state.auth.user // user account from our db
    }),
    ...mapGetters(['hasAuthenticated', 'isAuthenticated']),
    authId () {
      return (this.profile && this.profile.sub) || ''
    },
    currentDatetime () {
      return new Date().toISOString().slice(0, 19).replace('T', ' ')
    },
    userData () {
      return {
        name: this.profile.name,
        nickname: this.profile.nickname,
        email: this.profile.email,
        picture: this.profile.picture,
        auth_id: this.profile.sub,
        last_login: this.currentDatetime
      }
    }
  },
  apollo: {
    dbUser: {
      query: gql`query getUser($id: String!) {
        users(where: {auth_id: {_eq: $id}}) {
          id
          first_name
          last_name
          name
          nickname
          email
          date_of_birth
          phone
          street
          city
          state
          zip
          picture
          auth_id
          roles {
            name
          }
        }
      }`,
      variables () {
        return {
          id: this.authId
        }
      },
      update (data) {
        return data.users && data.users[0]
      }
    }
  },
  watch: {
    dbUser (foundUser) {
      if (!this.authId || this.user) {
        return
      }
      // The user query has run looking for a user based on the auth mixin id
      if (!foundUser || !foundUser.id) {
        this.createUser()
      } else {
        this.updateUser(foundUser)
      }
    }
  },
  methods: {
    login () {
      this.$store.dispatch('login')
    },

    logout () {
      this.$store.dispatch('logout')
    },

    createUser () {
      this.$apollo.mutate({
        mutation: gql`mutation createUser(
            $nickname:String!,
            $name:String!,
            $email:String!,
            $picture:String!,
            $auth_id:String!,
            $last_login:timestamptz!
          ) {
          insert_users(objects: {
            nickname: $nickname,
            name:$name,
            email:$email,
            picture:$picture,
            auth_id:$auth_id,
            last_log_in:$last_login
          }) {
            returning {
              id
              name
              nickname
              email
              picture
              auth_id
              roles {
                name
              }
            }
          }
        }`,
        variables: this.userData,
        loadingKey: 'savingCounter'
      }).then((result) => {
        const newUser = result.data.insert_users.returning[0]
        this.$store.dispatch('cacheUser', newUser)
      }).catch((error) => {
        console.error(error)
      })
    },

    updateUser (user) {
      this.$apollo.mutate({
        mutation: gql`mutation updateUser(
            $nickname:String!,
            $name:String!,
            $email:String!,
            $picture:String!,
            $auth_id:String!,
            $last_login:timestamptz!
          ) {
          update_users(where: {auth_id: {_eq: $auth_id}},
            _set: {
              nickname: $nickname,
              name: $name,
              email: $email,
              picture: $picture,
              auth_id: $auth_id,
              last_log_in: $last_login
          }) {
            affected_rows
          }
        }`,
        variables: this.userData,
        loadingKey: 'savingCounter'
      }).then(() => {
        this.$store.dispatch('cacheUser', user)
      }).catch((error) => {
        console.error(error)
      })
    }
  }
}
