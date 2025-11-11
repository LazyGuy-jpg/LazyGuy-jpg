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

# --- Mount Static Files and Templates ---
app.mount("/static", StaticFiles(directory="admin_panel/static"), name="static")
templates = Jinja2Templates(directory="admin_panel/templates")

# --- Firebase Initialization ---
SERVICE_ACCOUNT_KEY = os.getenv("SERVICE_ACCOUNT_KEY_PATH", "serviceAccountKey.json")
DATABASE_URL = os.getenv("FIREBASE_DATABASE_URL", "https://childsafe-mon-fb.firebaseio.com")

@app.on_event("startup")
def startup_event():
    """Initialize Firebase Admin SDK on application startup."""
    try:
        firebase_bridge.init_app(SERVICE_ACCOUNT_KEY, DATABASE_URL)
    except FileNotFoundError:
        print(f"WARNING: Firebase service account key not found at '{SERVICE_ACCOUNT_KEY}'.")
        print("Firebase features will be disabled.")
    except Exception as e:
        print(f"An error occurred during Firebase initialization: {e}")

# --- Authentication ---
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

async def get_current_user(token: str = Depends(oauth2_scheme)):
    """Dependency to verify Firebase token and get user data."""
    decoded_token = auth.verify_firebase_token(token)
    return decoded_token

# --- HTML Serving Endpoints ---
@app.get("/", response_class=HTMLResponse)
async def read_login(request: Request):
    """Serves the login page."""
    return templates.TemplateResponse("login.html", {"request": request})

@app.get("/dashboard", response_class=HTMLResponse)
async def read_dashboard(request: Request, current_user: Dict = Depends(get_current_user)):
    """Serves the main dashboard page, requires authentication."""
    return templates.TemplateResponse("dashboard.html", {"request": request, "user": current_user})

@app.get("/apk-builder", response_class=HTMLResponse)
async def read_apk_builder(request: Request, current_user: Dict = Depends(get_current_user)):
    """Serves the APK builder page, requires authentication."""
    return templates.TemplateResponse("apk_builder.html", {"request": request, "user": current_user})

@app.get("/fcm-console", response_class=HTMLResponse)
async def read_fcm_console(request: Request, current_user: Dict = Depends(get_current_user)):
    """Serves the FCM console page, requires authentication."""
    return templates.TemplateResponse("fcm_console.html", {"request": request, "user": current_user})


# --- API Endpoints ---
@app.get("/status")
def get_status():
    """API endpoint for basic server status."""
    return {"status": "online", "version": "1.1.0"}

@app.post("/build-apk")
async def build_apk_endpoint(request: Request, current_user: Dict = Depends(get_current_user)):
    """Placeholder endpoint for the APK builder form."""
    form_data = await request.form()
    print(f"User {current_user['uid']} initiated APK build with data: {form_data}")
    # In a real implementation, this would trigger a build script.
    return {"status": "build_started", "details": dict(form_data)}

@app.post("/send-fcm")
async def send_fcm_endpoint(request: Request, current_user: Dict = Depends(get_current_user)):
    """Placeholder endpoint for the FCM console form."""
    form_data = await request.json()
    child_id = form_data.get("child_id")
    command = form_data.get("command")
    print(f"User {current_user['uid']} sending FCM command: {command} to child {child_id}")
    # In a real implementation, this would call firebase_bridge.push_command
    return {"status": "fcm_sent", "child_id": child_id, "command": command}

@app.post("/command/{child_id}")
@auth.mutual_tls_required
async def send_command_to_child(
    child_id: str,
    command: Dict,
    current_user: Dict = Depends(get_current_user)
):
    """
    Sends a command to a specific child device via Firebase.
    Requires parent authentication.
    """
    parent_uid = current_user['uid']
    print(f"Parent {parent_uid} sending command to child {child_id}")

    try:
        firebase_bridge.push_command(child_id, command)
        return {"status": "command_sent", "child_id": child_id, "command": command}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- WebSocket for Media Relay ---
@app.websocket("/ws/media/{child_id}")
async def websocket_media_endpoint(
    websocket: WebSocket,
    child_id: str,
    token: str
):
    """
    WebSocket endpoint for relaying WebRTC media streams.
    Requires authentication via token in query parameter.
    """
    try:
        auth.verify_firebase_token(token)
        await websocket.accept()
        print(f"WebSocket connection accepted for child {child_id}")

        def sdp_callback(event):
            print(f"Received SDP data for {child_id}: {event.data}")
            pass

        sdp_listener = firebase_bridge.db.reference(f'sdp/{child_id}').listen(sdp_callback)

        try:
            while True:
                data = await websocket.receive_text()
                print(f"Received message from WebSocket client: {data}")

        except Exception as e:
            print(f"WebSocket error for child {child_id}: {e}")
        finally:
            sdp_listener.close()
            print(f"WebSocket connection closed for child {child_id}")

    except Exception as e:
        print(f"WebSocket authentication failed for child {child_id}: {e}")

if __name__ == "__main__":
    import uvicorn
    print("Starting Uvicorn server...")
    print("Access the admin panel at http://localhost:8000")
    uvicorn.run("api_ws:app", host="0.0.0.0", port=8000, reload=True)
