# Superhub 🔌

Superhub is the official App and Plugin Registry Server for **Supernote**. Built on **Node.js** and **Express**, it stores, manages, and securely serves versioned plugin bundles (JavaScript modules, CSS stylesheets, widgets, and assets) for dynamic, runtime loading in the Supernote Tauri application.

---

## ⚡ Key Features

*   **Versioned Plugin Registrations**: Organizes plugin configurations and bundles by version, automatically sorting them using SemVer-compliant descending logic.
*   **Dynamic Asset Serving**: Serves plugin assets directly, enabling dynamic runtime imports (`import()`) and live stylesheet injections in client frontends.
*   **Robust Security Guards**:
    *   Strict slug validation to prevent **Path Traversal** attacks.
    *   Robust path resolution checks to ensure asset requests never escape their designated plugin directories.
*   **Port Crash Protection**: Instantly detects and warns if the target port is already in use, exiting cleanly instead of failing silently.
*   **CORS Enabled**: Out-of-the-box Cross-Origin Resource Sharing enabled for seamless desktop client-to-registry integration.

---

## 📁 Repository Structure

```
superhub/
├── data/
│   └── plugins/               # Storehouse of all registered plugins and assets
│       ├── DesignSystem/      # Default DesignSystem plugin bundles & version jsons
│       ├── dark-theme-plus/   # Dark theme stylesheet plugin
│       └── super-note-exporter/# Note exporting workflow plugin
├── EXAMPLES.md                # Quick examples & curl commands for calling the endpoints
├── index.js                   # Main Express application entrypoint (API routes)
├── package.json               # Server dependencies (express, cors, slugify)
└── plugin-schema.json         # JSON schema describing valid plugin metadata fields
```

---

## 🚀 Installation & Running

### 1. Install Dependencies
Run the following command inside the `superhub` directory to install dependencies:
```bash
npm install
```

### 2. Start the Server
Start the Express registry server:
```bash
npm start
```
The server will start listening on **`http://localhost:3001`** by default.

---

## 📡 REST API Documentation

Detailed usage and client response snippets can be found in the [`EXAMPLES.md`](file:///c:/Files/Projects/SuperApps/superhub/EXAMPLES.md) file.

### 1. `POST /plugins`
Registers a new version of a plugin.
*   **Request Headers**: `Content-Type: application/json`
*   **Request Body**:
    ```json
    {
      "name": "My Note Tools",
      "version": "1.0.0",
      "description": "Utilities for note workflows",
      "author": "Example Dev",
      "entry": "index.js",
      "Files": [
        { "path": "index.js", "type": "local" },
        { "path": "styles.css", "type": "local" }
      ]
    }
    ```
*   **Response (201 Created)**:
    ```json
    {
      "message": "Plugin metadata created successfully",
      "slug": "my-note-tools",
      "version": "1.0.0"
    }
    ```

### 2. `GET /plugins`
Fetches the latest version metadata of each registered plugin.
*   **Response (200 OK)**:
    ```json
    [
      {
        "name": "My Note Tools",
        "version": "1.0.0",
        "slug": "my-note-tools",
        "entry": "/plugin-assets/my-note-tools/index.js",
        "_links": {
          "self": "http://localhost:3001/plugins/my-note-tools/1.0.0"
        }
      }
    ]
    ```

### 3. `GET /plugins/:slug`
Fetches all version metadata objects for a specific plugin, sorted descending by version.
*   **Response (200 OK)**:
    ```json
    [
      {
        "name": "My Note Tools",
        "version": "1.0.0",
        "slug": "my-note-tools"
      }
    ]
    ```

### 4. `GET /plugins/:slug/:version`
Fetches the metadata configuration object for a specific version of a plugin.

### 5. `GET /plugins/:slug/assets/*`
Serves static asset files associated with the plugin (e.g., `/plugins/my-note-tools/assets/styles.css`). This endpoint checks the workspace directories and serves files securely.
