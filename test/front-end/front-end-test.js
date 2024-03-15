const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto('http://localhost:4568/login');
    await page.screenshot({ path: 'login.png' });
    await page.type('#username', 'dillons');
    await page.type('#password', 'dillons');
    await page.screenshot({ path: 'login-info.png' });
    await page.click('#login');
    await page.waitForNavigation();

    await page.screenshot({ path: 'post-login.png' });

    await page.goto('http://localhost:4568/category/2/general-discussion');
    await page.click('#new_topic');
    await page.waitForNavigation();

    await page.screenshot({ path: 'new-post.png' });

    await browser.close();
})();
