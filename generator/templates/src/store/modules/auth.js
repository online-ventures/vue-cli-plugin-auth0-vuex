import auth0 from 'auth0-js'

const localStorage = window.localStorage

const webAuth = new auth0.WebAuth({
  domain: process.env.VUE_APP_AUTH0_DOMAIN,
  redirectUri: `${window.location.origin}/callback`,
  clientID: process.env.VUE_APP_AUTH0_CLIENT_ID,
  responseType: 'token id_token',
  scope: 'openid profile email',
  audience: process.env.VUE_APP_AUTH0_AUDIENCE
})

const localStorageKey = 'loggedIn'
const redirectKey = 'returnTo'

const state = () => {
  return {
    idToken: null,
    expiry: null,
    profile: {},
    accessToken: null,
    status: 'initialization',
    user: null
  }
}

const getters = {
  hasAuthenticated: () => {
    return localStorage.getItem(localStorageKey) === 'true'
  },

  isAuthenticated: (state, getters) => {
    return getters.hasAuthenticated &&
      state.idToken &&
      state.accessToken &&
      state.expiry && Date.now() < state.expiry.getTime()
  },

  roles: state => {
    if (!state.user || !state.user.roles) {
      return []
    }
    return state.user.roles.map((role) => role.name)
  },

  can: (state, getters) => permission => {
    if (getters.roles.includes('admin')) {
      return true
    } else if (permission === 'edit-things') {
      return getters.roles.includes('super-role')
    }
    return false
  }
}

const mutations = {
  CLEAR_AUTH (state) {
    state.idToken = null
    state.expiry = null
    state.profile = {}
    state.accessToken = null
  },
  SET_AUTH (state, auth) {
    state.idToken = auth.idToken
    state.expiry = auth.expiry
    state.profile = auth.profile
    state.accessToken = auth.accessToken
  },
  SET_AUTH_STATUS (state, status) {
    state.status = status
    if (status !== 'error') {
      state.error = null
    }
  },
  SET_AUTH_ERROR (state, error) {
    state.error = error
    state.status = 'error'
  },
  SET_TOKEN_RENEWAL (state, renewal) {
    state.tokenRenewal = renewal
  },
  SET_USER (state, user) {
    state.user = user
  }
}

const actions = {
  login ({ state, commit, dispatch }, customState) {
    if (state.status === 'authorizing') {
      return
    }
    dispatch('rememberReturnTo')
    commit('SET_AUTH_STATUS', 'authorizing')
    webAuth.authorize({
      appState: customState
    })
  },

  logout ({ commit }) {
    localStorage.removeItem(localStorageKey)
    commit('CLEAR_AUTH')
    commit('SET_AUTH_STATUS', 'logout')
    webAuth.logout({
      returnTo: process.env.VUE_APP_BASE_URL
    })
  },

  handleAuthentication ({ commit, dispatch }) {
    webAuth.parseHash((err, authResult) => {
      if (err) {
        commit('SET_AUTH_ERROR', err)
      } else {
        dispatch('localLogin', authResult)
      }
    })
  },

  localLogin ({ commit, dispatch }, authResult) {
    localStorage.setItem(localStorageKey, 'true')

    const auth = {
      idToken: authResult.idToken,
      accessToken: authResult.accessToken,
      expiry: new Date(authResult.idTokenPayload.exp * 1000),
      profile: authResult.idTokenPayload
    }

    commit('SET_AUTH', auth)
    commit('SET_AUTH_STATUS', 'authenticated')

    // TODO: Check to make sure that this is working on PWAs
    dispatch('scheduleRenewal')
  },

  cacheUser ({ commit }, user) {
    commit('SET_USER', user)
  },

  renewTokens ({ state, getters, commit, dispatch }, required = false) {
    return new Promise((resolve) => {
      if (state.status === 'checking' && !required) {
        return resolve(null)
      }

      if (getters.isAuthenticated) {
        return resolve(state.accessToken)
      }

      if (!getters.hasAuthenticated && required) {
        return dispatch('login')
      }

      commit('SET_AUTH_STATUS', 'checking')
      webAuth.checkSession({}, (err, authResult) => {
        if (err) {
          commit('SET_AUTH_ERROR', err)
          if (err.error === 'login_required' && required) {
            dispatch('login')
          }
        } else {
          dispatch('localLogin', authResult)
          resolve(state.accessToken)
        }
      })
    })
  },

  rememberReturnTo () {
    const url = window.location.pathname
    localStorage.setItem(redirectKey, url)
  },

  requireLogin ({ dispatch }) {
    dispatch('rememberReturnTo')
    dispatch('renewTokens', true)
  },

  renewalAttempted ({ state, commit }) {
    if (state.status === 'authenticated') {
      return
    }
    commit('SET_AUTH_STATUS', 'renewalAttempted')
  },

  getToken ({ state, subscribe }) {
    return new Promise((resolve, reject) => {
      if (state.status === 'authenticated') {
        resolve(state.accessToken)
      } else if (state.status === 'error') {
        reject(state.error)
      } else if (state.status === 'renewalAttempted') {
        resolve(null)
      } else {
        const unsubscribe = subscribe((mutation, state) => {
          if (mutation.type === 'SET_AUTH_STATUS') {
            if (state.status === 'authenticated') {
              unsubscribe()
              resolve(state.accessToken)
            } else if (state.status === 'error') {
              unsubscribe()
              reject(state.error)
            } else if (state.status === 'renewalAttempted') {
              resolve(null)
            }
          }
        })
      }
    })
  },

  scheduleRenewal ({ state, commit, dispatch }) {
    const delay = state.expiry - new Date()
    if (delay > 0) {
      const renewal = setTimeout(() => { dispatch('renewTokens') }, delay)
      commit('SET_TOKEN_RENEWAL', renewal)
    }
  }
}

export default {
  // namespaced: true,
  state,
  getters,
  mutations,
  actions
}
