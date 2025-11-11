// This file will handle Firebase Authentication.

async function initializeFirebase() {
    try {
        const response = await fetch('/firebase-config');
        if (!response.ok) {
            throw new Error('Failed to fetch Firebase config from server.');
        }
        const firebaseConfig = await response.json();

        if (!firebaseConfig.apiKey) {
            throw new Error('Firebase config from server is incomplete.');
        }

        firebase.initializeApp(firebaseConfig);
        console.log("Firebase initialized successfully.");
        return firebase.auth();
    } catch (error) {
        console.error("Firebase initialization failed:", error.message);
        alert("Could not initialize Firebase. Please ensure the server has the correct environment variables set.");
        return null;
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    const auth = await initializeFirebase();
    if (!auth) return; // Stop if Firebase didn't initialize

    // --- Event Listeners ---
    const googleLoginButton = document.getElementById('google-login');
    const loginForm = document.getElementById('login-form');
    const logoutButton = document.getElementById('logout-button');

    // Google Sign-In
    if (googleLoginButton) {
        googleLoginButton.addEventListener('click', () => {
            const provider = new firebase.auth.GoogleAuthProvider();
            auth.signInWithPopup(provider)
                .then((result) => {
                    console.log("Successfully signed in with Google:", result.user.displayName);
                    window.location.href = '/dashboard';
                })
                .catch((error) => {
                    console.error("Google Sign-In Error:", error.message);
                    alert("Error signing in with Google: " + error.message);
                });
        });
    }

    // Email/Password Sign-In
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;

            auth.signInWithEmailAndPassword(email, password)
                .then((userCredential) => {
                    console.log("Successfully signed in:", userCredential.user.email);
                    window.location.href = '/dashboard';
                })
                .catch((error) => {
                    console.error("Email Login Error:", error.message);
                    if (error.code === 'auth/user-not-found') {
                        if (confirm("No account found. Create one?")) {
                            auth.createUserWithEmailAndPassword(email, password)
                                .then(uc => {
                                    console.log("Account created:", uc.user.email);
                                    window.location.href = '/dashboard';
                                })
                                .catch(err => alert("Error creating account: " + err.message));
                        }
                    } else {
                        alert("Login Failed: " + error.message);
                    }
                });
        });
    }

    // Logout
    if (logoutButton) {
        logoutButton.addEventListener('click', () => {
            auth.signOut().then(() => {
                console.log("User signed out.");
                window.location.href = '/';
            });
        });
    }
});
