'use strict';

exports = module.exports = function(app, mongoose) {
  var schema = new mongoose.Schema({
    newExps:{type:Array, default:[]},
    eug0:{type:Array, default:[]},
    eug1:{type:Array, default:[]},
    eug2:{type:Array, default:[]},
    eug3:{type:Array, default:[]},
  });
  schema.plugin(require('./plugins/pagedFind'));
  schema.index({ search: 1 });
  schema.set('autoIndex', (app.get('env') === 'development'));
  app.db.model('ListExperiment', schema);
};
