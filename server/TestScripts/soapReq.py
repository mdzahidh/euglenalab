import urllib2
import json
import httplib
import sys

cmdIndex=0;
if len(sys.argv)>1: cmdIndex=int(sys.argv[1]);

#this is the server address
server_addr = '171.65.102.138:8081'
#server_addr = 'localhost:8082'
service_action = '/'

#unique identifier (GUID) for the service broker at Northwestern
identifier = 'C56A80D928264A0A900B30D610EDCB95'
#Password Stanford provides
euglenaPasskey = 'ZTUzYzU3OGE5NmM2MjZmNDIzNTVhMjlm'
# experiment id needs to be unique for every submission
experiment_id = '123456' 
if len(sys.argv)>2: experiment_id=sys.argv[2];
# you can change this experiment spec

spec_file = open('./expSpecs/encoded_6sec_led4_step.txt');
#experiment_spec = '2a0e030e00000000000000000000000f71000700e3001035000700ea001096000b00f2001289000000ed001937040000ed001d17000e00e3001d7b001200e2001e4b001500d8001ea5001200be001f13000e00b2001f6f000e00ff'
experiment_spec = spec_file.read();
print experiment_spec;


cancel = '<?xml version="1.0" encoding="utf-8"?>\
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">\
  <soap:Header>\
    <AuthHeader xmlns="http://ilab.mit.edu">\
      <identifier>%s</identifier>\
      <passKey>%s</passKey> \
    </AuthHeader>\
  </soap:Header>\
  <soap:Body>\
    <Cancel xmlns="http://ilab.mit.edu">\
      <experimentID>%s</experimentID>\
    </Cancel>\
  </soap:Body>\
</soap:Envelope>'

queue_length = '<?xml version="1.0" encoding="utf-8"?>\
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">\
  <soap:Header>\
    <AuthHeader xmlns="http://ilab.mit.edu">\
      <identifier>%s</identifier>\
      <passKey>%s</passKey>\
    </AuthHeader>\
  </soap:Header>\
  <soap:Body>\
    <GetEffectiveQueueLength xmlns="http://ilab.mit.edu">\
      <userGroup>0</userGroup>\
      <priorityHint>0</priorityHint>\
    </GetEffectiveQueueLength>\
  </soap:Body>\
</soap:Envelope>'

experiment_status = '<?xml version="1.0" encoding="utf-8"?>\
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">\
  <soap:Header>\
    <AuthHeader xmlns="http://ilab.mit.edu">\
      <identifier>%s</identifier>\
      <passKey>%s</passKey> \
    </AuthHeader> \
  </soap:Header>\
  <soap:Body>\
    <GetExperimentStatus xmlns="http://ilab.mit.edu">\
      <experimentID>%s</experimentID>\
    </GetExperimentStatus>\
  </soap:Body>\
</soap:Envelope>'

lab_config = '<?xml version="1.0" encoding="utf-8"?>\
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">\
  <soap:Header>\
    <AuthHeader xmlns="http://ilab.mit.edu">\
      <identifier>%s</identifier>\
      <passKey>%s</passKey>\
    </AuthHeader>\
  </soap:Header>\
  <soap:Body>\
    <GetLabConfiguration xmlns="http://ilab.mit.edu">\
      <userGroup>nan</userGroup>\
    </GetLabConfiguration>\
  </soap:Body>\
</soap:Envelope>'


lab_status = '<?xml version="1.0" encoding="utf-8"?>\
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">\
  <soap:Header>\
    <AuthHeader xmlns="http://ilab.mit.edu">\
      <identifier>%s</identifier>\
      <passKey>%s</passKey>\
    </AuthHeader>\
  </soap:Header>\
  <soap:Body>\
    <GetLabStatus xmlns="http://ilab.mit.edu" />\
  </soap:Body>\
</soap:Envelope>'

retrieve_result =  '<?xml version="1.0" encoding="utf-8"?>\
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">\
  <soap:Header>\
    <AuthHeader xmlns="http://ilab.mit.edu">\
      <identifier>%s</identifier>  \
      <passKey>%s</passKey> \
    </AuthHeader>\
  </soap:Header>\
  <soap:Body>\
    <RetrieveResult xmlns="http://ilab.mit.edu">\
      <experimentID>%s</experimentID>\
    </RetrieveResult>\
  </soap:Body>\
</soap:Envelope>'

experiment_submit = '<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">\
  <soap:Header>\
    <AuthHeader xmlns="http://ilab.mit.edu">\
      <identifier>%s</identifier>  \
      <passKey>%s</passKey> \
    </AuthHeader>\
  </soap:Header>\
  <soap:Body>\
    <Submit xmlns="http://ilab.mit.edu">\
      <experimentID>%s</experimentID>\
      <experimentSpecification>%s</experimentSpecification>\
      <userGroup>0</userGroup>\
      <priorityHint>0</priorityHint>\
    </Submit>\
  </soap:Body>\
</soap:Envelope>'

validate = '<?xml version="1.0" encoding="utf-8"?>\
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">\
  <soap:Header>\
    <AuthHeader xmlns="http://ilab.mit.edu">\
      <identifier>%s</identifier>\
      <passKey>%s</passKey>\
    </AuthHeader>\
  </soap:Header>\
  <soap:Body>\
    <Validate xmlns="http://ilab.mit.edu">\
      <experimentSpecification>%s</experimentSpecification>\
      <userGroup>%s</userGroup> \
    </Validate>\
  </soap:Body>\
</soap:Envelope>'

cancel = cancel % (str(identifier), str(euglenaPasskey), str(experiment_id))
queue_length = queue_length % (str(identifier), str(euglenaPasskey))
experiment_status = experiment_status %(str(identifier), str(euglenaPasskey), str(experiment_id))
lab_config = lab_config % (str(identifier), str(euglenaPasskey))
lab_status = lab_status % (str(identifier), str(euglenaPasskey))
retrieve_result = retrieve_result %(str(identifier), str(euglenaPasskey), str(experiment_id))
experiment_submit = experiment_submit %(str(identifier), str(euglenaPasskey), str(experiment_id), str(experiment_spec))
validate = validate % (str(identifier), str(euglenaPasskey), str(experiment_spec), '0')

print "0 cancel, 1 queue_length, 2 experiment_status, 3 lab_config, 4 lab_status, 5 retrieve_result, 6 experiment_submit, 7 validate"

#reassign for different request
arr=[cancel, queue_length, experiment_status, lab_config, lab_status, retrieve_result, experiment_submit, validate]
current_test = arr[cmdIndex]

request = httplib.HTTPConnection(server_addr)
request.putrequest("POST", service_action)
request.putheader("Accept", "application/soap+xml, application/dime, multipart/related, text/*")
request.putheader("Content-Type", "text/xml; charset=utf-8")
request.putheader("Cache-Control", "no-cache")
request.putheader("Pragma", "no-cache")
request.putheader("User-Agent", "Mozilla/5.0")
request.putheader("Content-Length", str(len(current_test)))
request.endheaders()
request.send(current_test)

response=request.getresponse()
data=response.read()
if cmdIndex==5:
  import re;
  bindata=re.split('base64targz', data)[1];
  bindata=bindata[4:];
  bindata=bindata[:-5];
  text_file = open("./data/Output.txt", "w");
  text_file.write(bindata);
  text_file.close();
  #base64 -di ./data/Output.txt > ./data/123456.tar.gz
else:
  print data;
request.close()
#this should print a matching response depending on the type of request.  See the excel tracker for a matching response






