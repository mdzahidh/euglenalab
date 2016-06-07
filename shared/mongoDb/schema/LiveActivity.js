'use strict';
exports = module.exports = function(app, mongoose) {
  var mySchema = new mongoose.Schema({
    user: {
      id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      name: { type: String, default: '' }
    },
    bpuExperiment: {
      id: { type: mongoose.Schema.Types.ObjectId, ref: 'BpuExperiment' },
    },
    allTypes: { type: Array, default: [] },
    type: { type: Array, default: [] },
    data: { type: Object, default: {} },
    metadata: { 

    },
  });
  mySchema.plugin(require('./plugins/pagedFind'));
  mySchema.index({ username: 1 }, { unique: true });
  mySchema.index({ timeCreated: 1 });
  mySchema.index({ search: 1 });
  mySchema.set('autoIndex', (app.get('env') === 'development'));
  app.db.model('User', mySchema);
};
