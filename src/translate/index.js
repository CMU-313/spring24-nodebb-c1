// eslint-disable-next-line strict
require('dotenv').config();
const fetch = require('node-fetch');

const translatorApi = module.exports;
const translatorApiUrl = 'https://translator-service-cwmfb7fbpq-uc.a.run.app';

translatorApi.translate = async function (postData) {
    // Construct the request URL
    const requestUrl = `${translatorApiUrl}/?content=${postData.content}`;

    try {
        const response = await fetch(requestUrl);
        const data = await response.json();
        return [data.is_english, data.translated_content];
    } catch (error) {
        console.error('Error in translatorApi.translate:', error);
        throw error;
    }
};
