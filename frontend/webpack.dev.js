const merge = require('webpack-merge');
const common = require('./webpack.common.js');

module.exports = merge(common, {
  mode: 'development',
  devtool: 'inline-source-map',
  devServer: {
    historyApiFallback: {
      disableDotRule: true,
    }, 
    proxy: {
      '/graphql': {
        // onProxyReq: (preq, req, res) => {
        //   console.log(res);
        // },
        target: 'http://pi-net-mon.local:4000',
        // changeOrigin: true,
        // secure: false,
        // cookieDomainRewrite: 'localhost',
        debug: true
      }
    }
  }
});