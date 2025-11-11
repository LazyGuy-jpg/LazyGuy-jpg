// This file will handle Firebase Authentication.

document.addEventListener('DOMContentLoaded', function () {
    try {
        // Initialize Firebase
        // IMPORTANT: You must configure your own firebaseConfig object.
        // This is typically found in your Firebase project settings.
        const firebaseConfig = {
            apiKey: "YOUR_API_KEY",
            authDomain: "YOUR_AUTH_DOMAIN",
            projectId: "YOUR_PROJECT_ID",
            storageBucket: "YOUR_STORAGE_BUCKET",
            messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
            appId: "YOUR_APP_ID"
        };
        firebase.initializeApp(firebaseConfig);

        const auth = firebase.auth();

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
                        window.location.href = '/dashboard'; // Redirect on success
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
                        console.log("Successfully signed in with email:", userCredential.user.email);
                        window.location.href = '/dashboard';
                    })
                    .catch((error) => {
                        console.error("Email Login Error:", error.message);
                        // Optional: Create account if it doesn't exist
                        if (error.code === 'auth/user-not-found') {
                            if (confirm("No account found. Create one with this email and password?")) {
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
                    window.location.href = '/'; // Redirect to login page
                });
            });
        }

    } catch (e) {
        console.error("Firebase initialization error. Please ensure you have configured your firebaseConfig object in /static/auth.js and included the Firebase SDKs in your HTML.", e);
        alert("Firebase is not configured. Please check the console for details.");
    }
});
