import asyncio
import os
from fastapi import FastAPI, WebSocket, Depends, HTTPException, Request
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse
from fastapi.security import OAuth2PasswordBearer
from typing import Dict

import firebase_bridge
import auth

# --- App Initialization ---
app = FastAPI(title="ChildSafe Monitoring Server")
app.mount("/static", StaticFiles(directory="admin_panel/static"), name="static")
templates = Jinja2Templates(directory="admin_panel/templates")

# --- Firebase Initialization & Config ---
SERVICE_ACCOUNT_KEY = os.getenv("SERVICE_ACCOUNT_KEY_PATH", "serviceAccountKey.json")
DATABASE_URL = os.getenv("FIREBASE_DATABASE_URL", "https://childsafe-mon-fb.firebaseio.com")

@app.on_event("startup")
def startup_event():
    try:
        firebase_bridge.init_app(SERVICE_ACCOUNT_KEY, DATABASE_URL)
    except Exception as e:
        print(f"WARNING: Firebase init failed: {e}")

@app.get("/firebase-config")
def get_firebase_config():
    config = {
        "apiKey": os.getenv("FIREBASE_API_KEY"),
        "authDomain": os.getenv("FIREBASE_AUTH_DOMAIN"),
        "projectId": os.getenv("FIREBASE_PROJECT_ID"),
        "storageBucket": os.getenv("FIREBASE_STORAGE_BUCKET"),
        "messagingSenderId": os.getenv("FIREBASE_MESSAGING_SENDER_ID"),
        "appId": os.getenv("FIREBASE_APP_ID")
    }
    if not all(config.values()):
        raise HTTPException(status_code=500, detail="Firebase config missing on server.")
    return config

# --- Authentication ---
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")
async def get_current_user(token: str = Depends(oauth2_scheme)):
    return auth.verify_firebase_token(token)

# --- HTML Serving Endpoints ---
@app.get("/", response_class=HTMLResponse)
async def read_login(request: Request):
    return templates.TemplateResponse("login.html", {"request": request})

@app.get("/dashboard", response_class=HTMLResponse)
async def read_dashboard(request: Request, child_id: str, user: Dict = Depends(get_current_user)):
    return templates.TemplateResponse("dashboard.html", {"request": request, "user": user, "child_id": child_id})

# --- API Endpoints ---
@app.post("/register-child")
async def register_child(request: Request):
    data = await request.json()
    print(f"Registering child: {data.get('child_id')}")
    return {"status": "ok"}

# --- WebSocket for Media Relay ---
@app.websocket("/ws/media/{child_id}")
async def websocket_media_endpoint(websocket: WebSocket, child_id: str, token: str):
    try:
        auth.verify_firebase_token(token)
        await websocket.accept()
        # ... (signaling logic from before)
    except Exception as e:
        print(f"WS Auth failed: {e}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api_ws:app", host="0.0.0.0", port=8000, reload=True)
