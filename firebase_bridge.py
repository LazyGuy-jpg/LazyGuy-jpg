import firebase_admin
import os
from firebase_admin import credentials, db

def init_app(service_account_key_path: str, database_url: str):
    """
    Initializes the Firebase Admin SDK.
    Args:
        service_account_key_path: Path to the Firebase service account key JSON file.
        database_url: The URL of the Firebase Realtime Database.
    """
    if not os.path.exists(service_account_key_path):
        raise FileNotFoundError(
            f"Firebase service account key not found at '{service_account_key_path}'. "
            "Please ensure the path is correct and the file exists."
        )

    cred = credentials.Certificate(service_account_key_path)
    firebase_admin.initialize_app(cred, {
        'databaseURL': database_url
    })
    print("Firebase Admin SDK initialized successfully.")

def push_command(child_id: str, cmd: dict):
    """
    Pushes a command to a specific child's command queue in Firebase.
    """
    if not firebase_admin._apps:
        raise Exception("Firebase Admin SDK not initialized. Call init_app() first.")

    ref = db.reference(f'commands/{child_id}')
    ref.push(cmd)
    print(f"Pushed command to child {child_id}: {cmd}")

def listen_sdp(child_id: str, callback):
    """
    Listens for SDP offers from a child and triggers a callback.
    """
    if not firebase_admin._apps:
        raise Exception("Firebase Admin SDK not initialized. Call init_app() first.")

    ref = db.reference(f'sdp/{child_id}')
    ref.listen(callback)
    print(f"Started listening for SDP offers for child {child_id}.")

if __name__ == '__main__':
    # Example Usage:
    # 1. Set environment variables for your Firebase project.
    #    export SERVICE_ACCOUNT_KEY_PATH="path/to/your/serviceAccountKey.json"
    #    export FIREBASE_DATABASE_URL="https://your-project-id.firebaseio.com"
    #
    # 2. Run this script.

    key_path = os.getenv("SERVICE_ACCOUNT_KEY_PATH")
    db_url = os.getenv("FIREBASE_DATABASE_URL")

    if key_path and db_url:
        try:
            init_app(key_path, db_url)
            # Example of pushing a command
            # push_command('test_child_01', {'type': 'ping', 'timestamp': 'now'})
        except FileNotFoundError as e:
            print(e)
        except Exception as e:
            print(f"An error occurred: {e}")
    else:
        print("firebase_bridge.py created. Please set environment variables for testing.")
