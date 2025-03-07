const express = require("express");
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");

puppeteer.use(StealthPlugin());

const app = express();
const PORT = process.env.PORT || 3000;
const STEAM_ID = "76561198021323440";

// 🔥 **Cache für gespeicherte Daten**
let cachedData = {
    premierRating: "-",
    premierWins: "-",
    lastUpdated: null
};

let retryCount = 0; // **💡 Retry-Zähler**
const MAX_RETRIES = 20; // **🔄 Maximale Versuche (20x)**

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

// 🌍 **Scraper-Funktion für Premier Stats mit Retry-Limit**
async function scrapePremierStats() {
    if (retryCount >= MAX_RETRIES) {
        console.log(`❌ MAXIMALE RETRIES (${MAX_RETRIES}) ERREICHT! KEIN NEUER VERSUCH.`);
        return;
    }

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

            // 🏆 **Daten in Cache speichern (mit Tausendertrennzeichen)**
            cachedData = {
                premierRating: formatNumber(premierData.rating),
                premierWins: formatNumber(premierData.wins),
                lastUpdated: new Date()
            };

            retryCount = 0; // **✅ Reset Retry-Zähler**
        } else {
            retryCount++; // **🔄 Erhöhe Retry-Zähler**
            console.log(`⚠ KEINE GÜLTIGEN DATEN GEFUNDEN, ERNEUTER VERSUCH (${retryCount}/${MAX_RETRIES}) in 30 Sekunden...`);
            setTimeout(scrapePremierStats, 30 * 1000);
        }

        await browser.close();
    } catch (error) {
        console.error("❌ FEHLER BEIM SCRAPEN:", error);
        if (browser) await browser.close();
        retryCount++; // **🔄 Erhöhe Retry-Zähler**
        setTimeout(scrapePremierStats, 30 * 1000);
    }
}

// 🔄 **Automatische Updates alle 10 Minuten**
async function autoUpdate() {
    await scrapePremierStats();
    setInterval(scrapePremierStats, 30 * 60 * 1000);
}
autoUpdate();

// 🎥 **API-Endpoint für OBS Overlay**
app.get("/obs-overlay", (req, res) => {
    const eloNumber = cachedData.premierRating;
    const firstPart = eloNumber.slice(0, -3); // Erste Ziffern
    const lastThree = eloNumber.slice(-3); // Letzte drei Ziffern

    res.send(`
        <html>
        <head>
            <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@700&display=swap" rel="stylesheet">
	<script>
   		 	setTimeout(function() {
        		location.reload();
    		}, 5000); // 30 Sekunden Refresh
	</script>

<script>
    let currentElo = 0;
    let currentWins = 0;

    function animateNumber(element, start, end, duration) {
        let range = end - start;
        let stepTime = Math.abs(Math.floor(duration / range));
        let startTime = performance.now();

        function step() {
            let elapsedTime = performance.now() - startTime;
            let progress = elapsedTime / duration;
            let value = Math.round(start + (range * progress));

            if ((range > 0 && value >= end) || (range < 0 && value <= end)) {
                value = end;
            }

            element.innerText = value.toLocaleString("en-US");

            if (value !== end) {
                requestAnimationFrame(step);
            }
        }
        requestAnimationFrame(step);
    }

    function updateData() {
        fetch("/obs-overlay-data")
            .then(response => response.json())
            .then(data => {
                let newElo = parseInt(data.premierRating.replace(/,/g, ""), 10) || 0;
                let newWins = parseInt(data.premierWins.replace(/,/g, ""), 10) || 0;

                if (newElo !== currentElo) {
                    animateNumber(document.getElementById("elo-number"), currentElo, newElo, 4000);
                    currentElo = newElo;
                }

                if (newWins !== currentWins) {
                    animateNumber(document.getElementById("wins-number"), currentWins, newWins, 4000);
                    currentWins = newWins;
                }
            })
            .catch(err => console.error("❌ Error fetching data:", err));
    }

    setInterval(updateData, 5000); // ✅ Real data updates every 5 seconds
</script>




            <style>
                body {
                    font-family: 'Roboto', sans-serif;
                    font-size: 52px;
                    color: white;
                    background: transparent;
                    text-align: center;
                    padding: 10px;
                    text-shadow: 3px 3px 0px rgba(0, 0, 0, 0.75);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    height: 100vh;
                    width: 100vw;
                }
                .elo-container {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    position: relative;
                    width: 220px;
                    height: auto;
                }
                .elo-number {
                    font-size: 54px;
                    font-weight: bold;
                    font-family: 'Roboto', sans-serif;
                    position: absolute;
                    text-align: center;
                    color: ${getEloColor(cachedData.premierRating)};
                    text-shadow: 3px 3px 0px rgba(0, 0, 0, 0.95);
                    transform: skew(-15deg) translateX(7px);
                }
                .elo-small {
                    font-size: 36px;
                }
                .elo-background img {
                    width: 220px;
                    height: auto;
                }
                .wins {
                    color: #04bf00;
                    text-shadow: 3px 3px 0px rgba(0, 0, 0, 0.75);
                    margin-left: 10px;
                }
            </style>
        </head>
        <body>
            <div class="elo-container">
                <div class="elo-background">
                    <img src="${getEloFrame(cachedData.premierRating)}" alt="Elo Frame">
                </div>
                <span class="elo-number" id="elo-number">${firstPart}<span class="elo-small">${lastThree}</span></span>
            </div> 
            <span> | WINS: <span id="wins-number" class="wins">${cachedData.premierWins}/125</span>
        </body>
        </html>
    `);
});

// 🎨 **Funktion für Elo-Farben**
function getEloColor(rating) {
    if (!rating || rating === "-") return "rgba(183,199,214,255)";
    const elo = parseInt(rating.replace(/[^0-9]/g, ""), 10) || 0;
    if (elo >= 30000) return "rgba(253,215,0,255)";
    if (elo >= 25000) return "rgba(236,74,72,255)";
    if (elo >= 20000) return "rgba(227,20,240,255)";
    if (elo >= 15000) return "rgba(189,106,253,255)";
    if (elo >= 10000) return "rgba(104,125,234,255)";
    if (elo >= 5000) return "rgba(137,187,229,255)";
    return "rgba(183,199,214,255)";
}

// 🎨 **Funktion für Elo-Rahmen**
function getEloFrame(rating) {
    if (!rating || rating === "-") return "https://i.imgur.com/pOLvm9D.png";
    const elo = parseInt(rating.replace(/[^0-9]/g, ""), 10) || 0;
    if (elo >= 30000) return "https://i.imgur.com/FhmJRgu.png";
    if (elo >= 25000) return "https://i.imgur.com/K9zpXg2.png";
    if (elo >= 20000) return "https://i.imgur.com/Axt1sJF.png";
    if (elo >= 15000) return "https://i.imgur.com/sBn03Kf.png";
    if (elo >= 10000) return "https://i.imgur.com/PStbp8P.png";
    if (elo >= 5000) return "https://i.imgur.com/EwABxKg.png";
    return "https://i.imgur.com/pOLvm9D.png";
}

// 📊 **Zahlen mit Tausendertrennzeichen formatieren**
function formatNumber(num) {
    return num ? parseInt(num.replace(/[^0-9]/g, ""), 10).toLocaleString("en-US") : "-";
}

// 🚀 **Server starten**
app.listen(PORT, () => {
    console.log(`🚀 OBS OVERLAY LÄUFT AUF PORT ${PORT}`);
});
