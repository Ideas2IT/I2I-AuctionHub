# How to Export Google Sheet to Excel for ICL Auction

## Steps to Download Your Google Sheet as Excel:

1. **Open your Google Sheet** ("ICL Auction List")

2. **Go to File Menu:**
   - Click on **File** in the top menu bar

3. **Download as Excel:**
   - Hover over **Download**
   - Click on **Microsoft Excel (.xlsx)**

4. **Save the File:**
   - Save the downloaded file as: **`ICL Auction List.xlsx`**
   - **Important:** Place it in the root folder of your project (same folder as `package.json`)

5. **File Location:**
   ```
   C:\Users\sundaravel.v\Documents\ICL\
   ├── ICL Auction List.xlsx  ← Place file here
   ├── package.json
   ├── server/
   └── client/
   ```

6. **Restart the Application:**
   - Run `restart.bat` or `npm start`
   - The application will automatically detect and load:
     - Teams from the "Team Name" sheet/tab
     - Players from the "Player List" sheet/tab

## File Structure Expected:

Your Excel file should have:
- **Sheet/Tab 1:** "Team Name" (or any sheet with "team" in the name) - Contains team names
- **Sheet/Tab 2:** "Player List" (or any sheet with "player" in the name) - Contains player names/emails

The application will automatically find the correct sheets based on their names!

## Alternative: Export as CSV

If you prefer CSV format:
1. In Google Sheets, go to **File → Download → Comma-separated values (.csv)**
2. Save as: **`ICL Auction List.csv`**
3. Place in the root folder

**Note:** CSV files can only contain one sheet, so you may need separate CSV files for teams and players, or combine them.

