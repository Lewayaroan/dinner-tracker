# 🫓 Parish Priest Dinner Log & Monthly Bill

A simple, beautiful, and mom-friendly web application to track daily dinners prepared for the Parish Priest and automatically generate itemized monthly bills.

---

### ✨ Features Built For You & Your Mom:

1. **⚡ 1-Click Quick Add for Today**:
   - Big, friendly banner at the top showing today's date.
   - Just click **"Add 4 Chapathis (₹80)"** and today's dinner is instantly logged!
   - Shows a green checkmark once today's dinner is recorded.

2. **📅 Interactive Monthly Calendar**:
   - Clear calendar view with daily color badges:
     - 🫓 Amber badge for **Home Cooked Chapathis** (shows count & cost).
     - 🥡 Purple badge for **Outside Food** (shows details & cost).
     - 🟢 Green indicator for daily total.
   - Click on any day to add, modify, or delete that day's entry.

3. **🫓 Chapathi Calculation (Fixed ₹20)**:
   - Preset buttons: `[0]`, `[2]`, `[3]`, `[4]`, `[5]` or `[-] / [+]` buttons.
   - Fixed rate: **₹20 per chapathi** (e.g. 4 chapathis = ₹80).
   - Rate can be customized in Settings if needed.

4. **🥡 Outside Food Support**:
   - Toggle on **"Bought Outside Food"** when food is purchased from outside/hotels.
   - Enter food item details (e.g. *"2 Parottas & Gravy"*, *"Meals"*, *"Idli"*).
   - Enter amount paid in Rupees (₹).
   - Both chapathis and outside food can be recorded on the same day if needed.

5. **🧾 Automatic Monthly Bill & Invoice**:
   - Select any month (e.g. *October 2026*).
   - Displays a clean, formal itemized statement table with dates, food particulars, quantities, rates, and amounts.
   - Calculates **Chapathis Subtotal**, **Outside Food Subtotal**, and **Grand Total**.
   - Includes **Amount in Words** (e.g. *Rupees Two Thousand Four Hundred Only*).
   - **Print / Save as PDF**: Formatted cleanly for A4 printing with signatures.
   - **Copy WhatsApp Summary**: 1-click button to copy a neat WhatsApp text message with all details to send directly to Father or Parish committee.
   - **Export CSV**: For Excel spreadsheets.

6. **🎙️ குரல் வழி பதிவு (Tamil Voice Assistant for Mom)**:
   - Mom can simply press the green **`"தமிழில் பேசுங்கள்"`** button and speak naturally in Tamil!
   - Examples she can say:
     - 🫓 *"இன்னைக்கு 4 சப்பாத்தி"* (or *"நாலு சப்பாத்தி"*) -> Automatically records 4 chapathis (₹80)!
     - 🥡 *"பரோட்டா 120 ரூபாய்"* -> Automatically records Parotta for ₹120!
     - 🥡 *"ஹோட்டல் சாப்பாடு 150 ரூபாய்"* -> Automatically records Meals for ₹150!
     - 🥡 *"இட்லி 60 ரூபாய்"* -> Automatically records Idli for ₹60!
     - ❌ *"இன்னைக்கு சாப்பாடு இல்ல"* -> Marks no dinner!
     - 📅 *"நேத்து 4 சப்பாத்தி"* -> Records 4 chapathis for yesterday!
   - **Voice Confirmation**: The app will also speak back in Tamil (Text-To-Speech) to confirm to mom that the record was saved!

7. **⏰ 9:00 PM Reminder Notification**:
   - At **9:00 PM every evening**, if today's dinner has not been logged yet, the app automatically:
     - Sends a browser notification: *"⏰ Dinner Reminder: Father's dinner has not been entered yet today!"*
     - Plays a gentle pleasant dual-tone chime sound.
     - Displays a prominent reminder alert banner inside the app with a 1-tap **"Log Now"** button.
   - You can test the reminder sound and alert anytime in **Settings ⚙️ -> Test Reminder**.

8. **💾 Offline & Auto-Save**:
   - All records are saved automatically in browser storage (`localStorage`).
   - Backup & Restore buttons in Settings to keep your data safe.

---

### 🚀 How to Open and Use:

- **Option 1**: Simply double-click [`open_app.bat`](file:///c:/Users/acer/Downloads/APP/open_app.bat) or [`index.html`](file:///c:/Users/acer/Downloads/APP/index.html) to open in your browser.
- **Option 2 (Mobile / Phone)**:
  - You can open the file directly in Chrome / Edge / Safari on mobile, or host it on free platforms like GitHub Pages, Vercel, or Netlify so your mom can add it to her phone home screen like an app!
