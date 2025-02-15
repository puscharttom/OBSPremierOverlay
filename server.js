const express = require("express");
const puppeteer = require("puppeteer");

const app = express();
const PORT = process.env.PORT || 3000;

async function startBrowser() {
    console.log("🔄 Starte Puppeteer...");

    try {
        const browser = await puppeteer.launch({
            headless: true,
            executablePath: process.env.GOOGLE_CHROME_BIN || "/app/.apt/usr/bin/google-chrome",
            args: [
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-gpu",
                "--enable-javascript",
                "--window-size=1280x800"
            ],
        });

        console.log("✅ Puppeteer erfolgreich gestartet!");
        return browser;
    } catch (error) {
        console.error("❌ Fehler beim Starten von Puppeteer:", error);
        throw error;
    }
}

// Funktion zum Scrapen der Premier-Rating-Daten
async function scrapeCSStats(playerID) {
    let browser;
    try {
        browser = await startBrowser();
        const page = await browser.newPage();

        const url = `https://csstats.gg/player/${playerID}`;
        console.log(`🌍 Rufe Daten von: ${url}`);
        await page.goto(url, { waitUntil: "networkidle2" });

        // Warten, bis das Element mit Premier-Rating geladen ist
        await page.waitForSelector('img[alt="Premier - Season 2"]', { timeout: 15000 });

        // Premier-Rating finden
        const premierRating = await page.evaluate(() => {
            const premierElement = document.querySelector('img[alt="Premier - Season 2"]');
            if (!premierElement) return "Keine Daten";

            const parentDiv = premierElement.closest('.ranks');
            if (!parentDiv) return "Keine Daten";

            const ratingElement = parentDiv.querySelector(".cs2rating span");
            return ratingElement ? ratingElement.innerText.trim() : "Keine Daten";
        });

        // Premier-Wins finden
        const premierWins = await page.evaluate(() => {
            const premierElement = document.querySelector('img[alt="Premier - Season 2"]');
            if (!premierElement) return "Keine Daten";

            const parentDiv = premierElement.closest('.ranks');
            if (!parentDiv) return "Keine Daten";

            const winsElement = parentDiv.querySelector(".wins b");
            return winsElement ? winsElement.innerText.trim() : "Keine Daten";
        });

        console.log(`✅ Premier-Rating: ${premierRating}`);
        console.log(`✅ Premier-Wins: ${premierWins}`);

        await browser.close();
        return { premierRating, premierWins };
    } catch (error) {
        console.error("❌ Fehler beim Scrapen:", error);
        if (browser) await browser.close();
        return { error: "Fehler beim Scrapen der Daten" };
    }
}

// API-Endpunkt für CSStats-Daten
app.get("/csstats/:playerID", async (req, res) => {
    const { playerID } = req.params;
    if (!playerID) return res.status(400).json({ error: "PlayerID fehlt" });

    const data = await scrapeCSStats(playerID);
    res.json(data);
});

// Starte den Server
app.listen(PORT, () => {
    console.log(`🚀 Server läuft auf Port ${PORT}`);
});
