# Migration Guide: Fly.io to PebbleHost

Follow these steps to migrate your `xivdyetools-discord-bot` to PebbleHost.

## 1. Preparation

### Local Files
1.  **Build your project locally** to ensure no errors:
    ```bash
    npm run build
    ```
2.  **Create a ZIP archive** of your bot files. Include ONLY the following:
    -   `src/` folder
    -   `emoji/` folder
    -   `package.json`
    -   `package-lock.json`
    -   `tsconfig.json`
    -   `deploy-commands.ts`
    -   `MIGRATION_GUIDE.md` (this file)

    > [!WARNING]
    > **DO NOT** include `node_modules`, `dist`, or `.git`. These will be regenerated on the server to ensure compatibility with PebbleHost's Linux environment.

### Dependencies
Ensure `xivdyetools-core` is accessible.
-   **If it is published to npm**: You are good to go.
-   **If it is a local/private package**:
    1.  Run `npm pack` inside your `xivdyetools-core` directory.
    2.  This generates a `.tgz` file (e.g., `xivdyetools-core-1.1.0.tgz`).
    3.  Include this `.tgz` file in your ZIP.
    4.  You may need to update `package.json` on the server to point to this file (e.g., `"xivdyetools-core": "file:./xivdyetools-core-1.1.0.tgz"`).

## 2. PebbleHost Setup

1.  **Select Node.js**: In the PebbleHost panel, ensure the server type is set to **Node.js** and select **Node.js 18** (or newer).
2.  **File Upload**:
    -   Go to the **File Manager** in the panel.
    -   Upload your ZIP file.
    -   Right-click and **Unarchive** (Unzip) it.
    -   Delete the ZIP file afterwards.

## 3. Configuration

### Environment Variables
1.  In the File Manager, create a new file named `.env`.
2.  Paste the contents of your local `.env` file into it.
3.  **Update Variables**:
    -   **Redis**: If you were using a Fly.io Redis URL, remove `REDIS_URL` (to use in-memory cache) or update it to your new provider.
    -   **Tokens**: Ensure `DISCORD_TOKEN` and `DISCORD_CLIENT_ID` are correct.

### Startup Command
In the PebbleHost Panel main page:
-   **Start Command**: `npm run start`
    -   *Note: This runs `node dist/index.js` as defined in your package.json.*

## 4. Installation & Build

**IMPORTANT**: You cannot run `npm` commands in the PebbleHost console.

### Option A: Build Locally (Recommended)
Since you cannot run build commands on the server easily, it is best to build locally and upload the compiled code.

1.  **Build Locally**:
    On your computer, run:
    ```bash
    npm run build
    ```
    This creates a `dist/` folder.

2.  **Update ZIP**:
    Create your ZIP file again, but this time **INCLUDE** the `dist/` folder.
    *   Include: `dist/`, `src/`, `emoji/`, `package.json`, `package-lock.json`, `.env`.
    *   Exclude: `node_modules`.

3.  **Upload**:
    Upload this new ZIP to PebbleHost and unarchive it (overwrite existing files).

### Option B: Automatic Dependency Installation
PebbleHost automatically installs dependencies listed in `package.json` when you start the server. You do **not** need to run `npm install` manually.

## 5. Launch

1.  **Start Command**: Ensure your start command in the panel is set to:
    ```bash
    node dist/index.js
    ```
2.  **Click Start**:
    -   The server will detect `package.json` and install dependencies (this may take a minute the first time).
    -   Then it will start the bot.
3.  **Watch Console**: Look for "Discord bot ready!".

## 6. Troubleshooting

-   **"Module not found"**: Ensure you ran `npm run build` successfully.
-   **Canvas/Sharp errors**:
    -   If you see errors related to `canvas` or `sharp`, try deleting `node_modules` and running `npm install --build-from-source`.
    -   Usually, pre-built binaries work fine on PebbleHost's Linux.
-   **"Address already in use"**: If the bot crashes regarding ports, ensure you aren't trying to bind to a restricted port. The bot's health check runs on port 3000 by default. You might need to disable the health check or ask PebbleHost support for an open port.
