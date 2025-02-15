const express = require("express");
const puppeteer = require("puppeteer");

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("✅ CSStatsBot is running!");
});

app.get("/csstats/:steamID", async (req, res) => {
  const steamID = req.params.steamID;
  console.log(`🔍 Scraping stats for Steam ID: ${steamID}`);

  let browser;
  try {
    browser = await puppeteer.launch({
      executablePath: "/usr/bin/chromium-browser", // Railway's system Chrome
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ],
    });

    const page = await browser.newPage();
    await page.goto(`https://csstats.gg/player/${steamID}`, {
      waitUntil: "networkidle2",
    });

    const data = await page.evaluate(() => {
      return {
        playerName: document.querySelector(".player-name")?.innerText || "N/A",
        rank: document.querySelector(".rank")?.innerText || "N/A",
        kdRatio: document.querySelector(".kd-ratio")?.innerText || "N/A",
      };
    });

    console.log(`✅ Scraped data:`, data);
    res.json({ success: true, data });

  } catch (error) {
    console.error("❌ Scraping fehlgeschlagen:", error);
    res.json({ success: false, message: "Scraping fehlgeschlagen", error: error.toString() });
  } finally {
    if (browser) await browser.close();
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server läuft auf Port ${PORT}`);
});
