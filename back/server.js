const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');
const session = require('express-session');
const crypto = require('crypto');
const cors = require('cors');
const jwt = require('jsonwebtoken')

const app = express();
const PORT = 3000;

var corsOptions = {
    "origin": "*",
    "methods": "GET,HEAD,PUT,PATCH,POST,DELETE",
    "preflightContinue": false,
    "optionsSuccessStatus": 204
  }

// Middleware
app.use(cors(corsOptions))
app.use(bodyParser.json());
app.use(express.static('public'));
app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: true,
}));

const generateNonce = () => crypto.randomBytes(16).toString('base64url');

const KEYCLOAK_URL = 'http://localhost:8080';
const REALM = 'ueno';
const CLIENT_ID = 'admin-cli';
const CLIENT_SECRET = 't2YRcwYGYHsztFpqdDrtMlUjuuukXXZK';

app.post('/webauthn/initiate-registration', async (req, res) => {
    const { username } = req.body;
    const nonce = generateNonce();
    req.session.nonce = nonce;

    const redirectUrl = new URL(`${KEYCLOAK_URL}/realms/${REALM}/protocol/openid-connect/auth`);
    redirectUrl.searchParams.append('client_id', CLIENT_ID);
    redirectUrl.searchParams.append('response_type', 'code');
    redirectUrl.searchParams.append('scope', 'openid');
    redirectUrl.searchParams.append('username', username);
    redirectUrl.searchParams.append('nonce', nonce);
    redirectUrl.searchParams.append('redirect_uri', 'http://localhost:3000/callback');

    console.log('Redirecting to Keycloak:', redirectUrl.toString());
    res.redirect(redirectUrl.toString());
});

app.post('/webauthn/complete-registration', async (req, res) => {
    const { credential } = req.body;

    try {
        const response = await axios.post(`${KEYCLOAK_URL}/realms/${REALM}/protocol/openid-connect/token`, {
            client_id: CLIENT_ID,
            // client_secret: CLIENT_SECRET,
            grant_type: 'urn:ietf:params:oauth:grant-type:webauthn',
            credential,
        });

        req.session.token = response.data.access_token;
        res.json({ success: true });
    } catch (error) {
        console.error('Registration error:', error.response.data);
        res.status(400).json({ error: 'Registration failed' });
    }
});

app.post('/webauthn/initiate-authentication', async (req, res) => {
    const { username } = req.body;
    const nonce = generateNonce();
    req.session.nonce = nonce;

    try {
        const response = await axios.post(`${KEYCLOAK_URL}/realms/${REALM}/protocol/openid-connect/auth`, {
            client_id: CLIENT_ID,
            username,
            nonce,
        });

        res.json(response.data);
    } catch (error) {
        console.error('Error initiating authentication:', error.response.data);
        res.status(400).json({ error: 'Authentication initiation failed' });
    }
});

app.post('/webauthn/complete-authentication', async (req, res) => {
    const { credential } = req.body;

    try {
        const response = await axios.post(`${KEYCLOAK_URL}/realms/${REALM}/protocol/openid-connect/token`, {
            client_id: CLIENT_ID,
            grant_type: 'urn:ietf:params:oauth:grant-type:webauthn',
            credential,
        });

        req.session.token = response.data.access_token;
        res.json({ success: true });
    } catch (error) {
        console.error('Error completing authentication:', error.response.data);
        res.status(400).json({ error: 'Authentication completion failed' });
    }
});

app.get('/callback', async (req, res) => {
    console.log("callback query ", req.query)
    const { code } = req.query;

    if (!code) {
        return res.status(400).json({ error: 'Authorization code not found' });
    }

    try {
        const tokenResponse = await axios.post(`${KEYCLOAK_URL}/realms/${REALM}/protocol/openid-connect/token`, new URLSearchParams({
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            grant_type: 'authorization_code',
            code: req.query.code,
            redirect_uri: 'http://localhost:3000/callback',
        }));

        req.session.token = tokenResponse.data.access_token;

        res.json({ success: true, token: tokenResponse.data });
    } catch (error) {
        console.error('Token exchange error:', error?.response?.data || error?.response || error);
        res.status(400).json({ error: 'Token exchange failed' });
    }
});

// // Callback Endpoint
// app.get('/callback', async (req, res) => {
//     const { id_token } = req.query; // Get the ID token from the query parameters
//     console.log("in callback", id_token)

//     // Verify nonce
//     const expectedNonce = req.session.nonce;
//     if (!expectedNonce) {
//         return res.status(400).json({ error: 'Nonce not found' });
//     }

//     // Decode the ID token to verify the nonce
//     const decodedToken = jwt.decode(id_token);
//     console.log("decodedToken", decodedToken)
//     if (decodedToken.nonce !== expectedNonce) {
//         return res.status(400).json({ error: 'Invalid nonce' });
//     }

//     // Optionally verify the ID token signature here

//     // If you need to exchange the ID token for an access token, do it here
//     try {
//         const tokenResponse = await axios.post(`${KEYCLOAK_URL}/realms/${REALM}/protocol/openid-connect/token`, new URLSearchParams({
//             client_id: CLIENT_ID,
//             client_secret: CLIENT_SECRET, // Only if your client is confidential
//             grant_type: 'authorization_code',
//             code: req.query.code, // Get the authorization code from the query parameters
//             redirect_uri: 'http://localhost:3000/callback',
//         }));

//         // Store the access token in session
//         req.session.token = tokenResponse.data.access_token;

//         res.json({ success: true, token: tokenResponse.data });
//     } catch (error) {
//         console.error('Token exchange error:', error?.response?.data || error?.response || error);
//         res.status(400).json({ error: 'Token exchange failed' });
//     }
// });

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});