var addr='192.168.1.100'
var port='4000';
var ip='http://'+addr+':'+port;
app={};
app.mainView={};
app.mainView.user={};
app.mainView.user.attributes={
  _id:'testid',
  username:'casey',
  sessionID:'xyz123',
  socketID:null,
};
app.mainView.mySocket=require('./browserClientSocket.js');
app.mainView.mySocket.setApp(app);
app.mainView.mySocket.connect(ip, function(err) {
  console.log('connet my socket err:'+err);
});
