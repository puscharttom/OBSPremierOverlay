# Benutze eine Node.js-Umgebung
FROM node:18

# Installiere Google Chrome für Puppeteer
RUN apt-get update && apt-get install -y wget curl unzip \
    && curl -fsSL https://dl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && echo "deb http://dl.google.com/linux/chrome/deb/ stable main" | tee /etc/apt/sources.list.d/google-chrome.list \
    && apt-get update && apt-get install -y google-chrome-stable

# Setze das Arbeitsverzeichnis auf /app
WORKDIR /app

# Kopiere das gesamte Projekt in den Container
COPY . .

# Installiere Node-Abhängigkeiten
RUN npm install

# Exponiere den Port 8080 für Railway
EXPOSE 8080

# Starte die Anwendung
CMD ["npm", "start"]
