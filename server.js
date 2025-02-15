const express = require("express");
const puppeteer = require("puppeteer");

const app = express();
const PORT = process.env.PORT || 3000;

async function scrapeStats(steamID) {
    console.log(`🔄 Starte Puppeteer für SteamID: ${steamID}`);

    let browser;
    try {
        browser = await puppeteer.launch({
            headless: "new", // Neues Headless-Modus für bessere Kompatibilität
            executablePath: "/usr/bin/google-chrome-stable", // Pfad für Render.com
            args: [
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-gpu",
                "--disable-dev-shm-usage",
                "--disable-software-rasterizer"
            ]
        });

        const page = await browser.newPage();
        const url = `https://csstats.gg/player/${steamID}`;
        console.log(`🌍 Öffne URL: ${url}`);
        
        await page.goto(url, { waitUntil: "networkidle2" });

        // Warte auf ein zentrales Element auf der Seite
        await page.waitForSelector(".player-stats", { timeout: 5000 });

        const stats = await page.evaluate(() => {
            const playerName = document.querySelector(".player-name")?.innerText || "Unbekannt";
            const rank = document.querySelector(".rank")?.innerText || "Keine Daten";
            return { playerName, rank };
        });

        console.log(`✅ Erfolgreich gescrapt:`, stats);
        return { success: true, data: stats };
    } catch (error) {
        console.error("❌ Fehler beim Scrapen:", error);
        return { success: false, message: "Scraping fehlgeschlagen", error: error.message };
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

// API-Route für Scraping
app.get("/csstats/:steamID", async (req, res) => {
    const steamID = req.params.steamID;
    const result = await scrapeStats(steamID);
    res.json(result);
});

// Test-Route
app.get("/", (req, res) => {
    res.send("✅ CSStats Scraper läuft auf Render.com!");
});

// Server starten
app.listen(PORT, () => {
    console.log(`🚀 Server läuft auf http://localhost:${PORT}`);
});
