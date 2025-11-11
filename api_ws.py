import os
from fastapi import FastAPI, WebSocket, Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from typing import Dict

import firebase_bridge
import auth

# --- App Initialization ---
app = FastAPI(title="ChildSafe Monitoring Server")

# --- Firebase Initialization ---
# Best practice: Load these from environment variables or a config file.
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
# This scheme expects the token to be sent in the 'Authorization' header.
# e.g., Authorization: Bearer <FIREBASE_ID_TOKEN>
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

async def get_current_user(token: str = Depends(oauth2_scheme)):
    """Dependency to verify Firebase token and get user data."""
    decoded_token = auth.verify_firebase_token(token)
    return decoded_token

# --- API Endpoints ---
@app.get("/")
def root():
    """Root endpoint for basic server status."""
    return {"status": "online", "version": "1.1.0"}

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
    # TODO: Add logic to verify that this parent is authorized for this child_id.
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
        # Authenticate the WebSocket connection
        auth.verify_firebase_token(token)
        await websocket.accept()
        print(f"WebSocket connection accepted for child {child_id}")

        # --- SDP Listening Setup ---
        def sdp_callback(event):
            # This is a basic callback. A real implementation would need to
            # handle this asynchronously and send data over the WebSocket.
            print(f"Received SDP data for {child_id}: {event.data}")
            # Example: asyncio.run(websocket.send_text(str(event.data)))
            pass

        sdp_listener = firebase_bridge.db.reference(f'sdp/{child_id}').listen(sdp_callback)

        try:
            while True:
                # This is where the aiortc relay logic would go.
                # The server would receive SDP/ICE from the client (Android)
                # and relay it to the parent (web panel).
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
    print("To test, set environment variables for SERVICE_ACCOUNT_KEY_PATH and FIREBASE_DATABASE_URL.")
    uvicorn.run("api_ws:app", host="0.0.0.0", port=8000, reload=True)
