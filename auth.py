import datetime
from functools import wraps
from fastapi import Request, HTTPException

import firebase_admin
from firebase_admin import auth

# For CA and certificate generation
from cryptography import x509
from cryptography.x509.oid import NameOID
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa

# --- Certificate Authority and Certificate Generation ---

def generate_private_key(filename: str = "private.key"):
    """Generates a new RSA private key and saves it to a file."""
    private_key = rsa.generate_private_key(
        public_exponent=65537,
        key_size=2048,
    )
    with open(filename, "wb") as f:
        f.write(private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption()
        ))
    return private_key

def generate_ca_cert(
    private_key,
    filename: str = "ca.pem",
    common_name: str = "ChildSafeMonitoringCA"
):
    """Generates a self-signed CA certificate."""
    subject = issuer = x509.Name([
        x509.NameAttribute(NameOID.COUNTRY_NAME, u"US"),
        x509.NameAttribute(NameOID.STATE_OR_PROVINCE_NAME, u"California"),
        x509.NameAttribute(NameOID.LOCALITY_NAME, u"San Francisco"),
        x509.NameAttribute(NameOID.ORGANIZATION_NAME, u"ChildSafe"),
        x509.NameAttribute(NameOID.COMMON_NAME, common_name),
    ])

    cert = x509.CertificateBuilder().subject_name(
        subject
    ).issuer_name(
        issuer
    ).public_key(
        private_key.public_key()
    ).serial_number(
        x509.random_serial_number()
    ).not_valid_before(
        datetime.datetime.utcnow()
    ).not_valid_after(
        # Set expiry to 10 years
        datetime.datetime.utcnow() + datetime.timedelta(days=3650)
    ).add_extension(
        x509.BasicConstraints(ca=True, path_length=None), critical=True,
    ).sign(private_key, hashes.SHA256())

    with open(filename, "wb") as f:
        f.write(cert.public_bytes(serialization.Encoding.PEM))
    return cert

# --- Authentication Decorators and Functions ---

def mutual_tls_required(func):
    """
    Decorator placeholder to enforce mutual TLS.
    In a real-world scenario, the web server (e.g., Uvicorn with SSL params
    or a reverse proxy like Nginx) would be configured to require client
    certificates. The server would then pass certificate details to the
    FastAPI app, which could be checked here.
    """
    @wraps(func)
    async def wrapper(*args, **kwargs):
        # Example check if running behind a proxy that sets a header:
        # request: Request = kwargs.get("request")
        # if not request or "X-Client-Cert-Verified" not in request.headers:
        #     raise HTTPException(status_code=403, detail="Client certificate required or invalid.")
        print("INFO: Endpoint called with mTLS requirement (decorator is a placeholder).")
        return await func(*args, **kwargs)
    return wrapper

def verify_firebase_token(token: str):
    """Verifies a Firebase ID token and returns the decoded claims."""
    if not firebase_admin._apps:
        raise Exception("Firebase Admin SDK not initialized. Call init_app() first.")
    try:
        decoded_token = auth.verify_id_token(token)
        return decoded_token
    except auth.InvalidIdTokenError as e:
        raise HTTPException(status_code=401, detail=f"Invalid Firebase ID token: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error verifying Firebase token: {e}")

if __name__ == '__main__':
    print("auth.py: Generating new CA private key and certificate...")
    ca_key = generate_private_key("ca_private_key.pem")
    ca_cert = generate_ca_cert(ca_key, "ca_cert.pem")
    print("SUCCESS: ca_private_key.pem and ca_cert.pem generated.")
    print("These can be used to sign server and client certificates for mTLS.")
