#harmony-auth-check

import time
import requests
from flask import Response

def main(request):
    if 'id' not in request.args:
        return Response('{"info":"input error"}', status=400, mimetype='application/json') 
    etag = None
    check = 100
    while check > 0:
        headers = {'Prefer': 'wait=5'}  # <----- add hint
        user_id = request.args.get('id')
        if etag:
            headers['If-None-Match'] = etag
        resp = requests.get('https://us-central1-brother-nft.cloudfunctions.net/harmony-authenticate?id='+user_id+'&f=c', headers=headers)
        if resp.status_code == 200:
            etag = resp.headers.get('ETag')
            return resp.json()
        elif resp.status_code != 304:
            # back off if the server is throwing errors
            time.sleep(30)
            continue
        time.sleep(0.1)                   # <----- reduce delay between requests
        check = check - 1
    return Response('{"check":0}', status=401, mimetype='application/json')