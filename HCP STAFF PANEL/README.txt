HENDRY COUNTY PROJECT - STAFF COMMAND PANEL

Folder structure:

HCP-Staff-Panel/
├── index.html
└── assets/
    ├── HCP-Main.png
    └── staff-background.jpg

SETUP:
1. Put your existing HCP-Main logo in assets/HCP-Main.png.
2. The supplied GTA/FiveM image is already included as assets/staff-background.jpg.
3. Install dependencies from the `HCP STAFF PANEL` folder:
   npm install
4. Create a `.env` file with your Discord OAuth application values.
5. Run the panel with:
   npm run dev

The staff panel now supports Discord login/logout and session-based UI state.

Command functionality is still visual only, but authenticated staff can log in and access the dashboard.
