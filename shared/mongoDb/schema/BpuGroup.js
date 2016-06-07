'use strict';

exports = module.exports = function(app, mongoose) {
  var myShema = new mongoose.Schema({
    name: { type: String, default: 'default' },
    description: { type: String, default: 'default' },
    users: { type: Array, default: [] },
  });
  myShema.plugin(require('./plugins/pagedFind'));
  myShema.index({ name: 1 });
  myShema.set('autoIndex', app.config.isDevelopment);
  app.db.model('BpuGroup', myShema);
};
