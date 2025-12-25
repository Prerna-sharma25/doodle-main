import os
import base64
import io
import google.generativeai as genai
from flask import Flask, request, jsonify, render_template, session, redirect, url_for
from dotenv import load_dotenv
from PIL import Image
from functools import wraps
import json

# --- 1. FIREBASE IMPORTS ---
import firebase_admin
from firebase_admin import credentials, auth

# --- 2. INITIALIZE APP & FIREBASE ---

load_dotenv()
app = Flask(__name__)

app.secret_key = "any_secret_key_you_want" 

if not firebase_admin._apps:
    firebase_creds = os.getenv("FIREBASE_CREDENTIALS")
    if not firebase_creds:
        raise Exception("FIREBASE_CREDENTIALS environment variable not set in Render")
    cred_dict = json.loads(firebase_creds)
    cred = credentials.Certificate(cred_dict)
    firebase_admin.initialize_app(cred)


# --- 3. THE SECURITY GUARD (Authentication) ---
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user' not in session:
            return redirect(url_for('auth_page'))
        return f(*args, **kwargs)
    return decorated_function

# --- 4. NEW AUTH ROUTES ---
@app.route('/auth')
def auth_page():
    return render_template('auth.html')

@app.route('/login', methods=['POST'])
def login():
    data = request.json
    id_token = data.get('idToken')
    try:
        decoded_token = auth.verify_id_token(id_token)
        session['user'] = decoded_token['uid']
        return jsonify({"status": "success"}), 200
    except:
        return jsonify({"status": "error"}), 401

@app.route('/logout')
def logout():
    session.pop('user', None)
    return redirect(url_for('auth_page'))

# --- 5. YOUR ORIGINAL LOGIC (Unchanged) ---

try:
    API_KEY = os.getenv("GOOGLE_API_KEY")
    if not API_KEY:
        raise ValueError("GOOGLE_API_KEY not found in .env file.")
        
    genai.configure(api_key=API_KEY)
    # KEPT EXACTLY AS YOU HAD IT
    model = genai.GenerativeModel('gemini-2.5-flash-image-preview')
    print("Google AI Model initialized successfully.")
    
except Exception as e:
    print(f"Error initializing Google AI: {e}")
    model = None

@app.route('/')
@login_required 
def index():
    return render_template('index.html')

@app.route('/api/generate', methods=['POST'])
def generate_image():
    if model is None:
        return jsonify({"error": "AI model is not initialized. Check server logs."}), 500
    try:
        data = request.json
        prompt = 'Turn this sketch into a beautiful, detailed image'
        image_data_url = data.get('image_data')
        if not image_data_url:
            return jsonify({"error": "No image data provided."}), 400

        image_base64 = image_data_url.split(',')[1]
        image_bytes = base64.b64decode(image_base64)
        img = Image.open(io.BytesIO(image_bytes))

        response = model.generate_content(
            [prompt, img],
            generation_config={"response_modalities": ["TEXT", "IMAGE"]}
        )

        image_part = next(
            (part for part in response.candidates[0].content.parts if part.inline_data), 
            None
        )

        if not image_part:
            text_part = response.candidates[0].content.parts[0].text
            return jsonify({"error": f"AI could not generate image. Response: {text_part}"}), 500

        generated_image_bytes = image_part.inline_data.data
        generated_base64_string = base64.b64encode(generated_image_bytes).decode('utf-8')
        generated_mime_type = image_part.inline_data.mime_type
        output_image_url = f"data:{generated_mime_type};base64,{generated_base64_string}"
        
        return jsonify({"image_url": output_image_url})
    except Exception as e:
        print(f"An error occurred: {e}")
        return jsonify({"error": f"An internal server error occurred: {str(e)}"}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)