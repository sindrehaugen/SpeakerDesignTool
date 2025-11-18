# Speaker Design Tool v1.15

A professional, browser-based calculator for designing Low-Impedance (Low-Z) and High-Impedance (100V) audio systems.

## 📖 Overview

The **Speaker Design Tool** allows audio professionals, integrators, and DIY enthusiasts to accurately calculate voltage drop, SPL loss, and damping factor across complex, daisy-chained wiring topologies. Unlike simple calculators, this tool visualizes the signal path as a "tree," allowing you to see exactly how a cable run affects not just the speaker at the end, but every speaker tapped along the line.

The application runs entirely in your browser using local storage to save your custom equipment database and projects.

## ✨ Key Features

* **Dual Calculator Engines:**
    * **Low-Z Mode:** Calculates Load (Ω), Voltage Drop (%), Power Loss (W), SPL Loss (dB), and Damping Factor.
    * **100V Mode:** Calculates Total Power, Line Current, and Voltage at every speaker tap.
* **Topology Tree:** Build complex "Daisy Chain" lines. Add a root node (Start of line) and infinite child nodes (Taps) to simulate real-world wiring.
* **Smart Status Indicators:** Automatic color-coded warnings (Yellow/Red) based on professional audio standards:
    * *Voltage Drop:* Warning > 5%, Hazard > 10% (Stricter for Subwoofers).
    * *Damping Factor:* Warning < 20, Hazard < 10.
    * *100V Line:* Warning < 95V, Hazard < 90V.
* **Custom Database:** Manage your own inventory of Speakers, Cables, and Amplifiers. Data is saved to your browser.
* **Project Management:** Save and Load projects via CSV Import/Export.
* **PDF Reporting:** Generate professional client reports with system summaries and detailed calculation tables.

## 🚀 Quick Start (How to Run)

 This application is built with standard HTML, CSS, and JavaScript. It does not require a server, Node.js, or any installation process.

### Option 1: Download and Run
1.  Click the green **Code** button on this repository and select **Download ZIP**.
2.  Extract the ZIP file to a folder on your computer.
3.  Locate the file named `Speaker Design Tool.html`.
4.  Double-click to open it in your web browser (Chrome, Edge, Firefox, or Safari).

> **Note:** The application requires an internet connection the first time you load it to fetch the styling libraries (Tailwind CSS) and PDF generators (jsPDF).

## 🛠️ How to Use

### 1. Database Setup
Before calculating, populate your equipment in the **Database** tab.
* **Manual Entry:** Add speakers, cables, and amplifiers manually using the forms.
* **Import Sample Data (Recommended):** This repository includes sample CSV files (`amplifiers-db.csv`, `cables-db.csv`, `speakers-db.csv`).
    1. Go to the **Database** tab.
    2. Click the **Import CSV** button under the relevant category.
    3. Select the corresponding file from the downloaded repository folder.

### 2. Building a Line (Calculator View)
1.  **Start a Project:** Enter a project name at the top.
2.  **Create a Root:** Select an Amplifier and the first Speaker/Cable combination. Click "Add Calculation".
3.  **Daisy Chain:** To add the next speaker in the chain, ensure the "Select Amplifier" dropdown is empty, and select the previous node ID (e.g., `L-1`) in the "Tap Line" dropdown.
4.  **Analyze:** Review the results grid. Cells will turn **Yellow** (Warning) or **Red** (Hazard) if the cable run causes issues with sound quality or safety.

### 3. Reporting
Go to the **Reports** tab to see a system-wide summary of power usage and potential hazards. Fill in the project details and click **Generate PDF Report** to create a document ready for clients or installers.

## 📦 Sample Database Content

This repository includes optional CSV database files populated with industry-standard equipment.

> **Update Policy:** We expect to update these database files every 1–3 months with new equipment profiles.

**Amplifiers**
Ashly, Audac, Behringer, Blaze Audio, Crestron, Crown, DAP, Dynacord, Full Fat Audio, Hoellstern, Innosonix, K-Array, K-GEAR, Lab Gruppen, LD Systems, LEA Professional, Powersoft, QSC, RAM Audio, TOA Electronics, Wharfedale Pro, XTA, Yamaha.

**Cables**
Adam Hall, AudioQuest, Belden, Canare, Cordial, Crestron, Draka, Eurocable, Extron, Gotham, Klotz, LAPP, Liberty, Mogami, Procab, SCP, Sommer, Supra, Tasker, Titanex, Van Damme, West Penn.

**Speakers**
Audac, Biamp, Blaze Audio, Bose, EAW, JBL, K-array, K-gear, LD Systems, Martin Audio, Sonance, Yamaha.

## 🧮 Technical Theory & Standards

This tool uses rigorous math to ensure accuracy.

### Low-Impedance (Low-Z)
* **Voltage Drop:** Calculated based on the round-trip resistance of the specific cable leg plus the cumulative resistance of previous legs.
* **Damping Factor (DF):** Calculated at the *speaker terminals*, taking into account the amplifier's internal impedance and the total cable resistance.
    * High cable resistance mathematically guarantees a low Damping Factor, resulting in "muddy" bass.
* **Power Loss:** $P = I^2 \times R$. The tool highlights that voltage drop is actually a power problem. A 10% voltage drop results in a ~19% power loss.

### High-Impedance (100V)
* Calculates the voltage available at the transformer tap.
* **Standard:** < 90V is considered a Hazard as it may cause transformer saturation and distortion.

## 📂 Project Structure

* `Speaker Design Tool.html`: The main application file.
* `app.js`: Contains all logic for calculations, UI rendering, and PDF generation.
* `database.js`: Contains the initial default equipment data.
* `style.css`: Custom styling (overlays on top of Tailwind CSS).
* `manual.html`: The user manual.
* `amplifiers-db.csv`: Optional sample amplifier database.
* `cables-db.csv`: Optional sample cable database.
* `speakers-db.csv`: Optional sample speaker database.

## 🤝 Contributing

Contributions are welcome! If you have improvements for the calculation logic or UI:
1.  Fork the repository.
2.  Create a Feature Branch.
3.  Commit your changes.
4.  Push to the branch.
5.  Open a Pull Request.

## 📄 License

This project is licensed under the **GNU General Public License v3.0 (GPLv3)** - see the [LICENSE](LICENSE) file for details.

**What this means:**
* You may copy, distribute, and modify the software.
* If you distribute your own version of this software (modified or not), you **must** release it under the same GPLv3 license (open source).
* You must disclose the source code when you distribute the software.
* There is no warranty for this free software.
