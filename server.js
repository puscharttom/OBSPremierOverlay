const express = require("express");
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");

puppeteer.use(StealthPlugin());

const app = express();  // 🛠 Hier wurde `app` hinzugefügt
const PORT = process.env.PORT || 3000;  // 🛠 Hier wurde `PORT` hinzugefügt

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

        console.log(`🖥 Verwende Chrome unter: ${await browser.version()}`);
        return browser;
    } catch (error) {
        console.error("❌ Fehler beim Starten von Puppeteer:", error);
        throw error;
    }
}

async function scrapeCSStats(playerID) {
    let browser;
    try {
        browser = await startBrowser();
        const page = await browser.newPage();

        await page.setUserAgent(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36"
        );
        await page.setExtraHTTPHeaders({
            "accept-language": "en-US,en;q=0.9",
        });

        const url = `https://csstats.gg/player/${playerID}`;
        console.log(`🌍 Rufe Daten von: ${url}`);

        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });

        await new Promise(resolve => setTimeout(resolve, 5000));

        const blocked = await page.evaluate(() => {
            return document.body.innerText.includes("Bestätigen Sie, dass Sie ein Mensch sind");
        });

        if (blocked) {
            console.error("❌ Cloudflare blockiert den Zugriff!");
            await browser.close();
            return { error: "Cloudflare blockiert den Zugriff!" };
        }

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

        console.log(`✅ Premier-Rating: ${premierData.rating}`);
        console.log(`✅ Premier-Wins: ${premierData.wins}`);

        await browser.close();
        return { playerID, premierRating: premierData.rating, premierWins: premierData.wins };

    } catch (error) {
        console.error("❌ Fehler beim Scrapen:", error);
        if (browser) await browser.close();
        return { error: "Fehler beim Scrapen der Daten" };
    }
}

// **API-Endpunkt für CSStats-Daten**
app.get("/csstats/:playerID", async (req, res) => {
    const { playerID } = req.params;
    if (!playerID) return res.status(400).send("❌ PlayerID fehlt!");

    const data = await scrapeCSStats(playerID);

    if (data.error) return res.send(`❌ Fehler: ${data.error}`);

    res.send(`Rating: ${data.premierRating} | Wins: ${data.premierWins}`);
});

// **🚀 Starte den Server**
app.listen(PORT, () => {
    console.log(`🚀 Server läuft auf Port ${PORT}`);
});
