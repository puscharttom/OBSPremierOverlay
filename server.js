const express = require("express");
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");

puppeteer.use(StealthPlugin());

const app = express();
const PORT = process.env.PORT || 3000;
const STEAM_ID = "76561198021323440";

// 🔥 **Cache für gespeicherte Daten**
let cachedData = {
    premierRating: "Lädt...",
    premierWins: "Lädt...",
    lastUpdated: null
};

// 🚀 **Browser-Start-Funktion**
async function startBrowser() {
    console.log("🔄 Starte Puppeteer...");
    try {
        const browser = await puppeteer.launch({
            headless: "new",
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH ||
                "/usr/bin/google-chrome" ||
                "/usr/bin/chromium-browser" ||
                puppeteer.executablePath(),
            args: [
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-blink-features=AutomationControlled",
                "--disable-dev-shm-usage"
            ]
        });
        return browser;
    } catch (error) {
        console.error("❌ Fehler beim Starten von Puppeteer:", error);
        throw error;
    }
}

// 🌍 **Scraper-Funktion für Premier Stats**
async function scrapePremierStats() {
    let browser;
    try {
        browser = await startBrowser();
        const page = await browser.newPage();

        await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36");
        await page.setExtraHTTPHeaders({ "accept-language": "en-US,en;q=0.9" });

        const url = `https://csstats.gg/player/${STEAM_ID}`;
        console.log(`🌍 Rufe Daten von: ${url}`);
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
        await new Promise(resolve => setTimeout(resolve, 5000));

        let premierData = await page.evaluate(() => {
            let images = document.querySelectorAll("img");
            let premierDiv = null;

            images.forEach(img => {
                if (img.alt.includes("Premier - Season 2")) {
                    premierDiv = img.closest(".ranks");
                }
            });

            if (!premierDiv) {
                return { rating: null, wins: null };
            }

            let ratingElement = premierDiv.querySelector(".cs2rating span");
            let rating = ratingElement ? ratingElement.innerText.replace(",", "").trim() : null;

            let winsElement = premierDiv.querySelector(".wins b");
            let wins = winsElement ? winsElement.innerText.trim() : null;

            return { rating, wins };
        });

        if (premierData.rating && premierData.wins) {
            console.log(`✅ Premier-Rating: ${premierData.rating}`);
            console.log(`✅ Premier-Wins: ${premierData.wins}`);

            // 🏆 **Daten in Cache speichern**
            cachedData = {
                premierRating: premierData.rating,
                premierWins: premierData.wins,
                lastUpdated: new Date()
            };
        } else {
            console.log("⚠ Keine gültigen Daten gefunden, erneuter Versuch in 1 Minute...");
            setTimeout(scrapePremierStats, 60 * 1000); // Falls keine Daten, nach 1 Minute erneut versuchen
        }

        await browser.close();
    } catch (error) {
        console.error("❌ Fehler beim Scrapen:", error);
        if (browser) await browser.close();
        // Falls Scraping fehlschlägt, nochmal nach 1 Minute versuchen
        setTimeout(scrapePremierStats, 60 * 1000);
    }
}

// 🔄 **Automatische Updates alle 30 Minuten**
async function autoUpdate() {
    await scrapePremierStats(); // Erstes Scraping sofort starten
    setInterval(scrapePremierStats, 30 * 60 * 1000); // Danach alle 30 Minuten
}
autoUpdate();

// 🎥 **API-Endpoint für OBS Overlay**
app.get("/obs-overlay", (req, res) => {
    res.send(`
        <html>
        <head>
            <link href="https://fonts.cdnfonts.com/css/counter-strike" rel="stylesheet">
            <style>
                body {
                    font-family: 'Counter-Strike', sans-serif;
                    font-size: 36px;
                    color: white;
                    background: transparent;
                    text-align: left;
                    padding: 10px;
                }
                .rating {
                    color: ${getEloColor(cachedData.premierRating)};
                }
                .wins {
                    color: #00ff00;
                }
            </style>
        </head>
        <body>
            <span>Rank: <span class="rating">${cachedData.premierRating}</span> | Wins: <span class="wins">${cachedData.premierWins}</span>/125</span>
        </body>
        </html>
    `);
});

// 🎨 **Funktion für Elo-Farben**
function getEloColor(rating) {
    const elo = parseInt(rating, 10) || 0;
    if (elo >= 30000) return "rgba(253,215,0,255)";
    if (elo >= 25000) return "rgba(236,74,72,255)";
    if (elo >= 20000) return "rgba(227,20,240,255)";
    if (elo >= 15000) return "rgba(189,106,253,255)";
    if (elo >= 10000) return "rgba(104,125,234,255)";
    if (elo >= 5000) return "rgba(137,187,229,255)";
    return "rgba(183,199,214,255)";
}

// 🚀 **Server starten**
app.listen(PORT, () => {
    console.log(`🚀 OBS Overlay läuft auf Port ${PORT}`);
});
