const express = require('express');
const puppeteer = require('puppeteer');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware für JSON-Parsing
app.use(express.json());

// Route zum Scrapen von CSStats
app.get('/csstats/:steamId', async (req, res) => {
    const steamId = req.params.steamId;
    console.log(`📌 Starte Scraping für SteamID: ${steamId}`);

    let browser;
    try {
        // Browser starten
        browser = await puppeteer.launch({
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/app/.apt/usr/bin/google-chrome-stable',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-gpu',
                '--disable-dev-shm-usage'
            ]
        });

        const page = await browser.newPage();
        await page.goto(`https://csstats.gg/player/${steamId}`, { waitUntil: 'networkidle2' });

        // Daten extrahieren (Beispiel für eine Statistik)
        const playerData = await page.evaluate(() => {
            const name = document.querySelector('.player-name')?.innerText || 'Unbekannt';
            const rank = document.querySelector('.player-rank')?.innerText || 'Unbekannt';
            return { name, rank };
        });

        console.log(`✅ Erfolgreich gescraped: ${JSON.stringify(playerData)}`);
        res.json({ success: true, data: playerData });

    } catch (error) {
        console.error('❌ Fehler beim Scrapen:', error);
        res.status(500).json({ success: false, message: 'Scraping fehlgeschlagen', error: error.message });
    } finally {
        if (browser) {
            await browser.close();
        }
    }
});

// Standard-Route für die Homepage
app.get('/', (req, res) => {
    res.send('CSStats Scraper Bot läuft! 🚀');
});

// Server starten
app.listen(PORT, () => {
    console.log(`🚀 Server läuft auf Port ${PORT}`);
});
