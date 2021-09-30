#harmony-watch
import os
from flask import Flask, render_template, send_from_directory
app = Flask(__name__)


root = os.path.join(os.path.dirname(os.path.abspath(__file__)), "apple-watch-ui")

@app.route('/', methods=['GET'])
def main(request):
    path = request.path
    if (path == '/'):
        return send_from_directory(root, 'index.html')
    else:
        return send_from_directory(root, path[1:])
