import os
from twilio.rest import Client
from flask import Response
import uuid
import firebase_admin
from firebase_admin import credentials
from firebase_admin import firestore


#Connect to firebase
#Local dev
#cred = credentials.certificate('../.././serviceAccount.json')
#firebase_admin.initialize_app(cred)

project_id = 'brother-nft'
# Use the application default credentials
cred = credentials.ApplicationDefault()
firebase_admin.initialize_app(cred, {
  'projectId': project_id,
})
db = firestore.client()

#Set your Twilio API via environment variable
account_sid = os.getenv('TWILIO_SID')
auth_token = os.getenv('TWILIO_AUTH')

t_client = Client(account_sid, auth_token)


control_url = "https://us-central1-brother-nft.cloudfunctions.net/harmony-auth/?w="

#Get new UUID
#Register user to firebase

def getMsg(unique_key):
    return "Harmony Wallet, don't loose this link: "+control_url+unique_key

def getUUID(number):

    #Check if user in db
    users_ref = db.collection(u'harmony-wallet-poc').document(str(number))
    doc = users_ref.get()
    if doc.exists:
        user = {
            'read_key':doc.get('read_key'),
            'write_key':doc.get('write_key')
        }
        return user
    #Create user
    #Completely random UUID
    user = {
        u'read_key':str(uuid.uuid4().hex),
        u'write_key':str(uuid.uuid4().hex)
    }
    users_ref.set(user)
    return user

def register(request):
    phone_number = request.args.get('n')
    message = t_client.messages.create(  
                              messaging_service_sid='MG9cb817ccc5ef2d167fef5ebdc86f70d5', 
                              body=getMsg(getUUID(phone_number)['write_key']),      
                              to=phone_number
                          ) 
    return Response('{"sid":'+message.sid+'}', status=200, mimetype='application/json')

def getUser(request):
    phone_number = request.args.get('n')
    return Response('{"uuid":'+db[phone_number]+'}', status=200, mimetype='application/json')

def main(request):
    if 'n' not in request.args or 'f' not in request.args:
        return Response('{"info":"input error"}', status=400, mimetype='application/json') 
    f = request.args.get('f')
    if(f == 'r'):
        return register(request)
    elif(f=='g'):
        return getUser(request)
    elif(f=='t'):
        uuid = getUUID(0)
        message = getMsg(uuid['write_key'])
        return {'message':message}
    return Response('{"info":"input error"}', status=400, mimetype='application/json') 


    
 