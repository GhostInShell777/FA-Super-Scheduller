## **FA Super Scheduler PRO** — *Because waiting to post is for normies!* ^w^

So, it begins! **FA Super Scheduler PRO** is a specialized browser extension for **Chromium-based** browsers (Chrome, Brave, Edge, etc.) that finally fixes the "no scheduling" tragedy on **FurAffinity**. You can literally just throw your art into a queue, set the tags, descriptions, and ratings, and then go take a nap while the bot does the work. .w.

---

## 🚀 How to Install (The "Do It Yourself" Way)

Since this project is still in its "active brain-rot" development phase and isn't on the Chrome Web Store yet, you’ve gotta do it manually. Don’t worry, it’s easy!

1.  **Grab the code:** Click that big green **<> Code** button and **Download ZIP**, or just clone the repo if you're a git wizard.
2.  **Unpack it:** Stick that folder somewhere safe on your PC. 
3.  **Go to Extensions:** Type `chrome://extensions/` in your URL bar.
4.  **Developer Mode:** *Blin*, don't forget to toggle the **"Developer mode"** switch in the top right corner!
5.  **Load Unpacked:** Click **"Load unpacked"** and select the folder where the `manifest.json` is chilling.

**Oтак!** Now the icon should pop up in your bar. You're ready to go! >w<

---

## 📋 What’s Inside? (About the Project)

**FA Super Scheduler PRO** is basically my love letter to artists who are tired of manual uploads. It solves that annoying "I have to be awake at 3 AM to post for my US audience" problem. 

### **The "UwU" Features:**
* **Queue Management:** Toss multiple files in and rearrange them however you want. 
* **Full Metadata Support:** You can set **titles**, **descriptions**, **tags**, and **folders** without even touching the FA website.
* **Safety First:** Choose your **ratings** (General, Mature, Adult), toggle **"Scraps"**, or **lock comments** if you're feeling shy.
* **The Scheduler:** Pick a precise date and time. The extension just handles it. 
* **Silly Creature Alert:** I added built-in checks for file sizes and formats so you don't accidentally try to upload a 5GB video of a spinning ferret. .w.
* **Bilingual UI:** Supports both **English** and **Ukrainian**.

---

## ⚙️ How it Works (The Technical "Juice")

The extension uses **Manifest V3** and is split into three layers. 

### **The Layers:**
* **Frontend (Popup & Options):** The `popup.js` does the heavy lifting for user input and turns your files into **Base64** strings for local storage. Everything is saved in `chrome.storage.local`.
* **Background (The Brain):** The `background.js` is like the alarm clock. It uses `chrome.alarms` to check the queue every few minutes. It has a **retry logic** (up to 5 attempts) because, *mlya*, sometimes the internet just dies. It also forces a **40-second delay** between posts so the site doesn't think you're a malicious spam bot.
* **Core (Content Script):** When it's "go time," `content.js` gets injected into the FA submission page. It automates the clicking and form-filling right in the DOM.

---

## 🛡️ The "Secret Sauce": Bypassing CSP

> **Observation on Security:**
> *Mlya*, the **CSP (Content Security Policy)** on FurAffinity is a real headache if you try to do everything from the background. **Oтак**, here is how I fixed it: 

Instead of trying to force the **Background Script** to make complex fetch requests (which usually triggers a security tantrum), I passed the torch to the **Popup** and **Content Script**. 

Since the **Content Script** lives directly inside the FurAffinity page environment, it can interact with the **DOM** and submit forms as if it were a real human clicking buttons. The **Background script** is barely involved in the actual communication with FA—it's mostly just the manager who tells the Content Script when to wake up. This keeps the "story holes" in the security policy closed and makes the upload process super smooth. **Блін**, it works like a charm! ^w^

---

*Enjoy your automated posting! If it breaks... well, that's life, but I'm probably already giggling over the code trying to fix it. .w.*

How do you feel about the specific "Silly Creature Alert" logic—should we expand the file validation to include even more specific warnings?
