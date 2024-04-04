// eslint-disable-next-line strict
require('dotenv').config();
const fetch = require('node-fetch');

const translatorApi = module.exports;
const translatorApiKey = process.env.TRANSLATOR_API;

translatorApi.translate = async function (postData) {
    const response = await fetch(`${translatorApiKey}/?content=${postData.content}`);
    const data = await response.json();
    return [data.is_english, data.translated_content];
};
