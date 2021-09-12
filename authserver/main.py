from datetime import datetime
import time
from flask import Response
#Crappy in memory DB for now
db={}

def setCode(request):
    request_json = request.get_json()
    if request.args and 'id' in request.args:
        user_id = request.args.get('id')
        if user_id not in db:
            db[user_id]={}
        now = datetime.now()
        current_time = now.strftime("%Y%H%M")
        if(current_time in db[user_id]):
            return 'Code set'
        db[user_id][current_time]={}
        db[user_id][current_time]['code'] = request.args.get('code')
        return 'Code set'
    else:
        return f'Invalid parameters!'

def authorize(request):
    if request.args and 'id' and 'code' in request.args:
        user_id = request.args.get('id')
        now = datetime.now()
        current_time = now.strftime("%Y%H%M")
        if(current_time in db[user_id] 
            and db[user_id][current_time]['code'] == request.args.get('code')):
            db[user_id][current_time]['auth'] = True
            return f'Successfully authorized for the next minute'
        return f'Invalid auth code!'
    else:
        return f'Invalid parameters!'

def checkAuth(request):
    if request.args and 'id' in request.args:
        user_id = request.args.get('id')
        if(user_id in db):
            now = datetime.now()
            current_time = now.strftime("%Y%H%M")
            if(current_time in db[user_id]
                and 'auth' in db[user_id][current_time]):
                return Response('{"check":1}', status=200, mimetype='application/json')
    return Response('{"check":0}', status=304, mimetype='application/json')


def sup(request):
    #Remove in production
    return db

def main(request):
    if request.args and 'f' in request.args:
        f = request.args.get('f')
        if(f == 's'):
            return setCode(request)
        elif(f == 'a'):
            return authorize(request)
        elif(f == 'c'):
            return checkAuth(request)
        elif(f == 'x'):
            return sup(request)
        return f'Nothing to see here...'
