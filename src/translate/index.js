const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
var request = require('request')

const translatorApi = module.exports;

translatorApi.translate = async function (postData) {
    //const response = await fetch(process.env.TRANSLATOR_API+'/?content='+postData.content);
    const response = await fetch('https://translator-service-cwmfb7fbpq-uc.a.run.app//?content='+postData.content);
    const data = await response.json();
    return [data["is_english"], data["translated_content"]]
}