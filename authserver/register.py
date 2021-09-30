import os
from twilio.rest import Client
from flask import Response
import uuid
import firebase_admin
from firebase_admin import credentials
from firebase_admin import firestore

DMODE = os.getenv('HWDEV')
project_id = 'brother-nft'

#Connect to firebase
#Local dev
if DMODE == 'dev':
    print('local dev mode')
    cred = credentials.Certificate('../.././serviceAccount.json')
    firebase_admin.initialize_app(cred)

else:
    print('cloud mode')
    # Use the application default credentials
    cred = credentials.ApplicationDefault()
    firebase_admin.initialize_app(cred, {
    'projectId': project_id,
    })

db = firestore.client()

#Set your Twilio API via environment variable
account_sid = os.getenv('TWILIO_SID')
auth_token = os.getenv('TWILIO_AUTH')
msg_sid = os.getenv('TWILIO_MSG_SID')
t_client = Client(account_sid, auth_token)


control_url = "https://us-central1-brother-nft.cloudfunctions.net/harmony-auth/?w="

#Get new UUID
#Register user to firebase

def getMsg(unique_key,number):
    return "Harmony Wallet, don't loose this link: "+control_url+unique_key+'&n='+number

def getUUID(number):

    #Check if user in db
    users_ref = db.collection(u'harmony-wallet-poc').document(str(number))
    doc = users_ref.get()
    if doc.exists:
        user = {
            'device_id':doc.get('device_id'),
            'access_key':doc.get('access_key'),
            'confirm_code':doc.get('confirm_code')
        }
        return user
    #Create user
    #Completely random UUID
    user = {
        u'device_id':str(uuid.uuid4().hex),
        u'access_key':str(uuid.uuid4().hex),
        u'confirm_code':str(uuid.uuid4().hex)[-4:]
    }
    users_ref.set(user)

    #For performance later when we look up
    device_ref = db.collection(u'harmony-wallet-poc').document(user['device_id'])
    device_ref.set({u'access_key':user['access_key']})

    return user


def isRegistered(number):
    users_ref = db.collection(u'harmony-wallet-poc').document(str(number))
    doc = users_ref.get()
    return doc.exists

def isCorrectCode(number,code):
    users_ref = db.collection(u'harmony-wallet-poc').document(str(number))
    doc = users_ref.get()
    server_code = doc.to_dict()['confirm_code']
    return server_code != code

def getCodeMsg(code):
    return 'Your Harmony wallet device confirmation code is: '+code

def register(request):
    phone_number = request.args.get('n')

    if (isRegistered(phone_number)):
        return Response('{"error":"Already registered"}', status=400, mimetype='application/json', headers=cors_headers)

    userDetails = getUUID(phone_number)
    sendCode = smsCode(userDetails['confirm_code'],phone_number)

    responseJson={
        'sendCode':sendCode.sid
    }

    return Response(str(responseJson), status=200, mimetype='application/json', headers=cors_headers)

def validateCode(request):
    phone_number = request.args.get('n')
    if('c' not in request.args):
        return Response('{"error":"Invalid code"}', status=400, mimetype='application/json', headers=cors_headers)

    code = request.args.get('c')

    if (isCorrectCode(phone_number,code)):
        return Response('{"error":"Invalid code"}', status=400, mimetype='application/json', headers=cors_headers)

    userDetails = getUUID(phone_number)
    sendURL = smsURL(userDetails['access_key'],phone_number) 

    responseJson='{"device_id":"'+userDetails['device_id']+'"}'

    return Response(responseJson, status=200, mimetype='application/json', headers=cors_headers)

def getUser(number):
    #Check if user in db
    users_ref = db.collection(u'harmony-wallet-poc').document(str(number))
    doc = users_ref.get()
    if doc.exists:
        user = {
            'device_id':doc.get('device_id'),
            'access_key':doc.get('access_key'),
            'confirm_code':doc.get('confirm_code')
        }
        return user
    return None

def smsCode(confirm_code,phone_number):
    return t_client.messages.create(  
                              messaging_service_sid=msg_sid, 
                              body=getCodeMsg(confirm_code),      
                              to=phone_number)

def smsURL(access_key,phone_number):
    return t_client.messages.create(  
                              messaging_service_sid=msg_sid, 
                              body=getMsg(access_key,phone_number),      
                              to=phone_number
                          ) 


def resendCode(request):
    phone_number = request.args.get('n')
    userDetails = getUser(phone_number)
    return Response('{"sendCode":'+smsCode(userDetails['confirm_code'],phone_number).sid+'}', status=200, mimetype='application/json', headers=cors_headers)




# Set CORS headers for the main request
cors_headers = {
    'Access-Control-Allow-Origin': '*'
}



def main(request):
    # Set CORS headers for the preflight request
    if request.method == 'OPTIONS':
        # Allows GET requests from any origin with the Content-Type
        # header and caches preflight response for an 3600s
        headers = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Max-Age': '3600'
        }

        return ('', 204, headers)

    if 'n' not in request.args or 'f' not in request.args:
        return Response('{"info":"input error"}', status=400, mimetype='application/json', headers=cors_headers) 
    f = request.args.get('f')
    if(f == 'r'):
        return register(request)
    elif(f=='c'):
        return resendCode(request)
    elif(f=='v'):
        return validateCode(request)
    elif(f=='t'):
        #
        uuid = getUUID(0)
        number = request.args.get('n')
        confirmMsg= getCodeMsg(uuid['confirm_code'])
        accessMsg= getMsg(uuid['access_key'],number)
        return {'confirm-msg':confirmMsg, 'access-url-msg':accessMsg}
    return Response('{"info":"input error"}', status=400, mimetype='application/json', headers=cors_headers) 


    
 