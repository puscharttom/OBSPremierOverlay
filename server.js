const express = require("express");
const puppeteer = require("puppeteer");

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
    res.send("CSStatsPremBot ist online! 🚀");
});

app.get("/csstats/:steamID", async (req, res) => {
    const steamID = req.params.steamID;
    console.log(`🔍 Scraping für Steam-ID: ${steamID}`);

    try {
        const browser = await puppeteer.launch({
            headless: "new",
            executablePath: "/usr/bin/google-chrome-stable", // Render.com Chrome-Pfad
            args: [
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--disable-gpu",
                "--disable-software-rasterizer"
            ]
        });

        const page = await browser.newPage();
        const url = `https://csstats.gg/player/${steamID}`;
        console.log(`🌍 Öffne URL: ${url}`);

        await page.goto(url, { waitUntil: "networkidle2" });

        // Beispiel: Stats auslesen
        const stats = await page.evaluate(() => {
            const name = document.querySelector("h1.player-name")?.innerText || "Unbekannt";
            const rank = document.querySelector(".rank")?.innerText || "Keine Rangdaten";
            return { name, rank };
        });

        await browser.close();
        console.log("✅ Scraping erfolgreich:", stats);

        res.json({ success: true, steamID, stats });
    } catch (error) {
        console.error("❌ Fehler beim Scraping:", error);
        res.json({ success: false, message: "Scraping fehlgeschlagen", error: error.toString() });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Server läuft auf http://localhost:${PORT}`);
});
