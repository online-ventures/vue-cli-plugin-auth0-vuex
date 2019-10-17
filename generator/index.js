module.exports = (api, options) => {
  // extend package
  api.extendPackage({
    dependencies: {
      'auth0-js': '^9.11.2'
    }
  })

  api.render('./templates')
}
