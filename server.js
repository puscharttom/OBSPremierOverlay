const express = require("express");
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");

puppeteer.use(StealthPlugin());

const app = express();
const PORT = process.env.PORT || 3000;
const STEAM_ID = "76561198021323440";

// 🔥 **Cache für gespeicherte Daten**
let cachedData = {
    premierRating: "LÄDT...",
    premierWins: "LÄDT...",
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
        console.error("❌ FEHLER BEIM STARTEN VON PUPPETEER:", error);
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
            console.log(`✅ PREMIER-RATING: ${premierData.rating}`);
            console.log(`✅ PREMIER-WINS: ${premierData.wins}`);

            // 🏆 **Daten in Cache speichern, mit Uppercase und Tausendertrennzeichen**
            cachedData = {
                premierRating: formatNumber(premierData.rating).toUpperCase(),
                premierWins: formatNumber(premierData.wins).toUpperCase(),
                lastUpdated: new Date()
            };
        } else {
            console.log("⚠ KEINE GÜLTIGEN DATEN GEFUNDEN, ERNEUTER VERSUCH IN 1 MINUTE...");
            setTimeout(scrapePremierStats, 60 * 1000);
        }

        await browser.close();
    } catch (error) {
        console.error("❌ FEHLER BEIM SCRAPEN:", error);
        if (browser) await browser.close();
        setTimeout(scrapePremierStats, 60 * 1000);
    }
}

// 🔄 **Automatische Updates alle 30 Minuten**
async function autoUpdate() {
    await scrapePremierStats();
    setInterval(scrapePremierStats, 30 * 60 * 1000);
}
autoUpdate();

// 🎥 **API-Endpoint für OBS Overlay**
app.get("/obs-overlay", (req, res) => {
    res.send(`
        <html>
        <head>
            <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@700&display=swap" rel="stylesheet">
            <style>
                body {
                    font-family: 'Roboto', sans-serif;
                    font-size: 36px;
                    color: white;
                    background: transparent;
                    text-align: left;
                    padding: 10px;
                    text-shadow: 2px 2px 5px rgba(0, 0, 0, 0.75); /* ✅ Schatten für besseren Kontrast */
                }
                .elo-container {
                    display: inline-block;
                    position: relative;
                    padding: 10px;
                }
                .elo-number {
                    font-size: 36px;
                    font-weight: bold;
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    color: ${getEloColor(cachedData.premierRating)};
                    text-shadow: 2px 2px 5px rgba(0, 0, 0, 0.75); /* ✅ Schatten für die Zahl */
                }
                .elo-background {
                    width: 80px;
                    height: 80px;
                    background-image: url('${getEloFrame(cachedData.premierRating)}');
                    background-size: contain;
                    background-repeat: no-repeat;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    position: relative;
                }
                .wins {
                    color: #00ff00;
                    text-shadow: 2px 2px 5px rgba(0, 0, 0, 0.75); /* ✅ Schatten für die Win-Zahl */
                }
            </style>
        </head>
        <body>
            <span>ELO: 
                <div class="elo-container">
                    <div class="elo-background"></div>
                    <span class="elo-number">${cachedData.premierRating}</span>
                </div> 
                | WINS: <span class="wins">${cachedData.premierWins}</span>/125
            </span>
        </body>
        </html>
    `);
});

// 🎨 **Funktion für Elo-Farben**
function getEloColor(rating) {
    if (!rating) return "rgba(183,199,214,255)";
    const elo = parseInt(rating.replace(/[^0-9]/g, ""), 10) || 0;
    if (elo >= 30000) return "rgba(253,215,0,255)";
    if (elo >= 25000) return "rgba(236,74,72,255)";
    if (elo >= 20000) return "rgba(227,20,240,255)";
    if (elo >= 15000) return "rgba(189,106,253,255)";
    if (elo >= 10000) return "rgba(104,125,234,255)";
    if (elo >= 5000) return "rgba(137,187,229,255)";
    return "rgba(183,199,214,255)";
}

// 📊 **Funktion zur Formatierung der Zahlen mit Tausendertrennzeichen**
function formatNumber(num) {
    if (!num) return "LÄDT...";
    return parseInt(num.replace(/[^0-9]/g, ""), 10).toLocaleString("de-DE"); // Entfernt falsche Zeichen & formatiert
}

// 🚀 **Server starten**
app.listen(PORT, () => {
    console.log(`🚀 OBS OVERLAY LÄUFT AUF PORT ${PORT}`);
});
