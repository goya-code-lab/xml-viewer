const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const PORT = 5555;
const DIST_DIR = path.resolve(__dirname, '../dist');

// Simple static server to serve the dist directory
const server = http.createServer((req, res) => {
    let urlPath = req.url.split('?')[0];
    let filePath = path.join(DIST_DIR, urlPath === '/' ? 'index.html' : urlPath);

    // If file doesn't exist, serve index.html (for SPA routing)
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        filePath = path.join(DIST_DIR, 'index.html');
    }

    const ext = path.extname(filePath);
    const contentType = {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.ico': 'image/x-icon',
        '.png': 'image/png',
        '.svg': 'image/svg+xml'
    }[ext] || 'text/plain';

    fs.readFile(filePath, (err, content) => {
        if (err) {
            console.error(`Error reading ${filePath}:`, err);
            res.writeHead(500);
            res.end(`Error: ${err.code}`);
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

server.listen(PORT, async () => {
    console.log(`[Prerender] Temp server running at http://localhost:${PORT}`);

    let browser;
    try {
        browser = await puppeteer.launch({
            headless: "new",
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();

        console.log('[Prerender] Navigating to app...');
        // We navigate to the local server
        await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle2' });

        console.log('[Prerender] Waiting for render-event script trigger...');
        await page.evaluate(() => {
            return new Promise(resolve => {
                if (window.__PRERENDERED__) return resolve(); // Already done?
                document.addEventListener('render-event', () => resolve(), { once: true });
                // Max timeout 15 seconds
                setTimeout(resolve, 15000);
            });
        });

        // Wait a bit more for any final layout adjustments
        await new Promise(r => setTimeout(r, 1000));

        console.log('[Prerender] Capturing HTML...');
        const html = await page.content();

        // Inject a flag to prevent double hydration issues if needed
        // const injectedHtml = html.replace('</body>', '<script>window.__PRERENDERED__=true;</script></body>');

        fs.writeFileSync(path.join(DIST_DIR, 'index.html'), html);
        console.log('[Prerender] Successfully updated dist/index.html');

    } catch (error) {
        console.error('[Prerender] Error during prerendering:', error);
        process.exit(1);
    } finally {
        if (browser) await browser.close();
        server.close();
        console.log('[Prerender] Temp server closed.');
    }
});
