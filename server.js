const express = require("express");
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");

puppeteer.use(StealthPlugin());

const app = express();
const PORT = process.env.PORT || 443;

// 🔥 Cache für gespeicherte Daten
let cachedData = {
    rating: "Lädt...",
    wins: "Lädt...",
    lastUpdated: null
};

// 🌍 Scraping-Funktion mit Auto-Update
async function scrapeCSStats() {
    let browser;
    try {
        browser = await puppeteer.launch({
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

        const page = await browser.newPage();
        await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36");
        await page.setExtraHTTPHeaders({ "accept-language": "en-US,en;q=0.9" });

        const url = `https://csstats.gg/player/76561198021323440`;
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
                return { rating: "Keine Daten", wins: "Keine Daten" };
            }

            let ratingElement = premierDiv.querySelector(".cs2rating span");
            let rating = ratingElement ? ratingElement.innerText.replace(",", "").trim() : "Keine Daten";

            let winsElement = premierDiv.querySelector(".wins b");
            let wins = winsElement ? winsElement.innerText.trim() : "Keine Daten";

            return { rating, wins };
        });

        console.log(`✅ Rank: ${premierData.rating}, Wins: ${premierData.wins}`);

        // 🔥 Speichere Daten im Cache
        cachedData = {
            rating: premierData.rating,
            wins: premierData.wins,
            lastUpdated: new Date()
        };

        await browser.close();
    } catch (error) {
        console.error("❌ Fehler beim Scrapen der Premier-Daten.", error);
        if (browser) await browser.close();
    }
}

// 🔄 **Automatische Updates alle 30 Minuten**
setInterval(() => {
    console.log("🔄 Automatische Aktualisierung der Daten...");
    scrapeCSStats();
}, 30 * 60 * 1000); // Alle 30 Minuten

// **🌍 OBS Overlay-Seite mit Auto-Refresh**
app.get("/obs-overlay", (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="de">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>OBS Overlay</title>
            <style>
                @font-face {
                    font-family: 'Counter-Strike';
                    src: url('https://www.dafont.com/download?file=counter-strike') format('truetype');
                }
                body {
                    font-family: 'Counter-Strike', sans-serif;
                    font-size: 32px;
                    color: white;
                    background: transparent;
                    text-align: left;
                    padding: 10px;
                }
                .rating {
                    font-weight: bold;
                }
                .wins {
                    color: green;
                }
            </style>
            <script>
                async function fetchData() {
                    const response = await fetch('/api/stats');
                    const data = await response.json();
                    document.getElementById('rating').innerText = data.rating;
                    document.getElementById('wins').innerText = data.wins;
                    setTimeout(fetchData, 30 * 60 * 1000); // 30 Minuten Refresh
                }
                window.onload = fetchData;
            </script>
        </head>
        <body>
            <span>Rank: <span id="rating" class="rating" style="color: ${getRankColor(cachedData.rating)}">${cachedData.rating}</span></span>
            <span> | Wins: <span id="wins" class="wins">${cachedData.wins}/125</span></span>
        </body>
        </html>
    `);
});

// **API für OBS-Overlay-Daten**
app.get("/api/stats", (req, res) => {
    res.json(cachedData);
});

// **🚀 Starte den Server**
app.listen(PORT, () => {
    console.log(`🚀 Server läuft auf Port ${PORT}`);
    scrapeCSStats(); // Sofort erstes Scraping starten
});

// **Rank-Farben basierend auf Elo**
function getRankColor(rating) {
    const ratingValue = parseInt(rating, 10);
    if (isNaN(ratingValue)) return "white";
    if (ratingValue < 5000) return "rgba(183,199,214,255)";
    if (ratingValue < 10000) return "rgba(137,187,229,255)";
    if (ratingValue < 15000) return "rgba(104,125,234,255)";
    if (ratingValue < 20000) return "rgba(189,106,253,255)";
    if (ratingValue < 25000) return "rgba(227,20,240,255)";
    if (ratingValue < 30000) return "rgba(236,74,72,255)";
    return "rgba(253,215,0,255)";
}
