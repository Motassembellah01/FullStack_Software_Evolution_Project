const jwtDecode = require('jwt-decode');
const axios = require('axios');
const url = require('url');
const keytar = require('keytar');
const os = require('os');

const apiIdentifier = process.env.AUTH0_AUDIENCE;
// AUTH0_DOMAIN can be "tenant.auth0.com" or "https://tenant.auth0.com/"
const rawDomain = process.env.AUTH0_DOMAIN;
const auth0Domain = rawDomain.replace(/^https?:\/\//, '').replace(/\/$/, '');
const clientId = process.env.AUTH0_CLIENT_ID || '';

const redirectUri = process.env.AUTH0_REDIRECT_URI || 'http://localhost/callback';
const logoutReturnTo = process.env.AUTH0_LOGOUT_RETURN_TO || 'http://localhost/logout';

const keytarService = 'electron-openid-oauth';
const keytarAccount = os.userInfo().username;

let accessToken = null;
let profile = null;
let refreshToken = null;

function getAccessToken() {
    return accessToken;
}

function getProfile() {
    return profile;
}

function getAuthenticationURL() {
    return (
        'https://' +
        auth0Domain +
        '/authorize?' +
        'audience=' +
        apiIdentifier +
        '&' +
        'scope=openid profile offline_access&' +
        'response_type=code&' +
        'client_id=' +
        clientId +
        '&' +
        'redirect_uri=' +
        redirectUri
    );
}

async function refreshTokens() {
    const refreshToken = await keytar.getPassword(keytarService, keytarAccount);

    if (refreshToken) {
        const refreshOptions = {
            method: 'POST',
            url: `https://${auth0Domain}/oauth/token`,
            headers: { 'content-type': 'application/json' },
            data: {
                grant_type: 'refresh_token',
                client_id: clientId,
                refresh_token: refreshToken,
            },
        };

        try {
            const response = await axios(refreshOptions);

            accessToken = response.data.access_token;
            profile = jwtDecode.jwtDecode(response.data.id_token);
        } catch (error) {
            await logout();

            throw error;
        }
    } else {
        throw new Error('No available refresh token.');
    }
}

async function loadTokens(callbackURL) {
    const urlParts = url.parse(callbackURL, true);
    const query = urlParts.query;

    const exchangeOptions = {
        grant_type: 'authorization_code',
        client_id: clientId,
        code: query.code,
        redirect_uri: redirectUri,
    };

    const options = {
        method: 'POST',
        url: `https://${auth0Domain}/oauth/token`,
        headers: {
            'content-type': 'application/json',
        },
        data: JSON.stringify(exchangeOptions),
    };

    try {
        const response = await axios(options);

        accessToken = response.data.access_token;
        profile = jwtDecode.jwtDecode(response.data.id_token);
        refreshToken = response.data.refresh_token;

        if (refreshToken) {
            await keytar.setPassword(keytarService, keytarAccount, refreshToken);
        }
    } catch (error) {
        await logout();

        throw error;
    }
}

async function logout() {
    await keytar.deletePassword(keytarService, keytarAccount);
    accessToken = null;
    profile = null;
    refreshToken = null;
}

function getLogOutUrl() {
    return `https://${auth0Domain}/v2/logout`;
}

async function logoutFromAuth0() {
    try {
        logout();
        const logoutUrl = getLogOutUrl();
        await axios.get(logoutUrl, {
            params: {
                client_id: clientId,
                returnTo: logoutReturnTo,
            },
        });
    } catch (error) {
        console.error("Erreur lors de la déconnexion d'Auth0:", error);
    }
}

module.exports = {
    getAccessToken,
    getAuthenticationURL,
    getLogOutUrl,
    getProfile,
    loadTokens,
    logout,
    refreshTokens,
    logoutFromAuth0,
};
