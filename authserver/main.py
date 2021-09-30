#harmony-authenticate

import os
from datetime import datetime
import time
from flask import Response
import firebase_admin
from firebase_admin import credentials
from firebase_admin import firestore

DMODE = os.getenv('HWDEV')
project_id = 'brother-nft'

#Connect to firebase
#Local dev
if DMODE == 'dev':
    print('local dev mode harmony-authenticate')
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


def getDevice(id):
    #Check if user in db
    device_ref = db.collection(u'harmony-wallet-poc').document(str(id))
    doc = device_ref.get()
    if doc.exists:
        device = {
            'access_key':doc.get('access_key'),
            'otp':doc.get('otp'),
        }
        return device
    return None

def setOtp(request):
    if 'id' and 'code' not in request.args:
        return Response('{"error":"param errors"}', status=400, mimetype='application/json')
    #Check if user in db
    device_id = request.args.get('id')
    otp = request.args.get('code')
    device_ref = db.collection(u'harmony-wallet-poc').document(str(device_id))
    doc = device_ref.get()
    if doc.exists:
        now = datetime.now()
        device_obj = doc.to_dict()
        current_time = now.strftime("%Y%H%M")
        if current_time in device_obj:
            return Response(str({"status":"Code set"}), status=200, mimetype='application/json', headers=cors_headers)
        device = {}
        device[current_time]=str(otp)
        device['access_key']=device_obj['access_key']
        device_ref.set(device)
        return Response(str({"status":"Code set"}), status=200, mimetype='application/json', headers=cors_headers)
    else:
        return Response(str({"status":"Invalid device"}), status=400, mimetype='application/json', headers=cors_headers)




def authorize(request):
    if request.args and 'id' and 'code' in request.args:
        device_id = request.args.get('id')
        now = datetime.now()
        current_time = now.strftime("%Y%H%M")
        device_ref = db.collection(u'harmony-wallet-poc').document(str(device_id))
        doc = device_ref.get()
        device_obj = doc.to_dict()
        if(current_time in device_obj
            and device_obj[current_time] == request.args.get('code')
            and device_obj['access_key'] == request.args.get('k')):
                device_obj['auth'] = True
                device_ref.set(device_obj)
                return Response(str({"status":"Authorized until the next minute"}), status=200, mimetype='application/json', headers=cors_headers)
        return Response(str({"status":"Invalid code"}), status=400, mimetype='application/json', headers=cors_headers)
    else:
        return Response(str({"status":"Invalid code"}), status=400, mimetype='application/json', headers=cors_headers)


def checkAuth(request):
    if request.args and 'id' in request.args:
        deviceId = request.args.get('id')
        device_ref = db.collection(u'harmony-wallet-poc').document(str(deviceId))
        doc = device_ref.get()
        device_obj = doc.to_dict()
        if doc.exists:
            print(device_obj)
            if('auth' in device_obj):
                now = datetime.now()
                #Can't rely on time as cloud function can be anywhere
                #current_time = now.strftime("%Y%H%M")
                #print(current_time)
                #if(current_time in device_obj):
                return Response('{"check":1}', status=200, mimetype='application/json', headers=cors_headers)
            return Response('{"check":0}', status=200, mimetype='application/json', headers=cors_headers)
    return Response('{"Status":"Device not found"}', status=400, mimetype='application/json', headers=cors_headers)



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

    if request.args and 'f' in request.args:
        f = request.args.get('f')
        if(f == 'o'):
            return setOtp(request)
        elif(f == 'a'):
            return authorize(request)
        elif(f == 'c'):
            return checkAuth(request)
    
    return Response(str({"status":"Invalid operationing mode"}), status=400, mimetype='application/json', headers=cors_headers)
