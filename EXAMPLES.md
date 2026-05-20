# Superhub Examples

This file contains quick examples for running and using the Superhub plugin registry API.

## 1. Start the server

```bash
npm install
npm start
```

Default URL: `http://localhost:3001`

## 2. Create a plugin metadata entry

### curl

```bash
curl -X POST http://localhost:3001/plugins \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Note Tools",
    "version": "1.0.0",
    "description": "Utilities for note workflows",
    "author": "Example Dev"
  }'
```

### PowerShell

```powershell
$body = @{
  name = "My Note Tools"
  version = "1.0.0"
  description = "Utilities for note workflows"
  author = "Example Dev"
} | ConvertTo-Json

Invoke-RestMethod -Method Post `
  -Uri "http://localhost:3001/plugins" `
  -ContentType "application/json" `
  -Body $body
```

## 3. Get latest version of each plugin

```bash
curl http://localhost:3001/plugins
```

## 4. Get all versions for one plugin

The slug is generated from the plugin name (lowercase, hyphen-separated).
For `My Note Tools`, slug becomes `my-note-tools`.

```bash
curl http://localhost:3001/plugins/my-note-tools
```

## 5. Get one specific version

```bash
curl http://localhost:3001/plugins/my-note-tools/1.0.0
```

## 6. Example response snippets

### POST /plugins success

```json
{
  "message": "Plugin metadata created successfully",
  "slug": "my-note-tools",
  "version": "1.0.0"
}
```

### GET /plugins/my-note-tools/1.0.0 success

```json
{
  "name": "My Note Tools",
  "version": "1.0.0",
  "description": "Utilities for note workflows",
  "author": "Example Dev",
  "slug": "my-note-tools"
}
```

## 7. Common error examples

### Missing required fields

If `name` or `version` is missing in `POST /plugins`, response is:

```json
{
  "error": "Plugin name and version are required."
}
```

### Invalid slug format

If slug has unsupported characters in `GET /plugins/:slug`, response is:

```json
{
  "error": "Invalid plugin slug format"
}
```
