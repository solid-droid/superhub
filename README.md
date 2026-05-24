# SuperHub
CDN for widgets, themes, apps and services
Made to work with SuperNote

# Server Files  
1. **Server.js** - entry point (Orchestrator) 
2. **Router.js** - All routes are written here in simplest protocol form  
                [protocol, payloadStructure, responseStructure]  
                (for complicated structures keep in extra files/folders)
3. **/Router** folder - each route handler is a file  
4. **/Helper** folder - for any helper/utility functions
5. **/Services** folder - for any database or other service related code

# Home Folder
Home page assets are now split into files under **/Home**:
1. **/Home/index.html** - root page markup shell
2. **/Home/home.css** - root page styles
3. **/Home/home.js** - root page client behavior

Current homepage scope:
1. API list
2. Metadata search, type filter, and sort (powered by `GET /meta`)
3. Widget playground is intentionally skipped for now

# Data Folder
local data folder -  
Folder structure is just for readabilty not used in server logic.  
**Server only cares about the meta.json files.**  
In production mostly Widgets, Themes, apps and services mostly come from remote repositories.

### Plugin Types
1. **/Widgets** folder -  widgets use html,css,js (mostly) (atoms, varients and components)  
3 catogaries - Widgets , WidgetVariant , WidgetTheme
2. **/Themes** folder - all themes are defined here - css (mostly)
3. **/Services** folder - all services are defined here - js (mostly)
3. **/Apps** folder - all apps are defined here (fully functional entity) - html,css,js (mostly)

## Widgets
1. **/Atoms** folder - all atomic widgets and varients are kept here
3. **/Components** folder - all components are kept here (combination of 1 or more atomic widgets)

## Standards
1. slug - is a unique identifier (versions not included)
```json
"slug": "{Entity-Type}>{Entity-Family}>{Entity-Identifier}"

example =>
"slug": "widget>design-system>Atom.button.icon"
```
2. version - is a unique identifier (slug+version = complete-entity-reference)
```json
example => "version": "1.0.0" //<major ver>.<minor ver>.<patch ver>
slug+version = complete-entity-reference  
example => "widget>design-system>Atom.input@1.0.0"
```

# APIs / Routes
1. `GET /meta` - returns list of meta
    ```json
    //Body
    {
      page: 0 //default
      pageSize: 100 //default
      filter: [
        {operator:"OpenBracket"},
        {value: "component" , operator: "in", field: "description"},
        {operator:"AND"},     
        {value: "widget>design-system>" , operator: "startsWith", field: "slug"}
        {operator:"CloseBracket"}
      ],
      sort:[
        {field:"name", order:"asc"},
        {field:"version", order:"desc"}
      ]
    }
    ```
2. `GET /meta/:slug` - returns list of meta
3. `GET /meta/:slug/:version` - returns single meta

4. `GET /summary`
```json
//Responce
{
    "Widgets": {
        "count": <number>,
        "families": [<slug>,...]
    },
    "Themes":{
        "count": <number>,
        "families": [<slug>,...]
    },
    "Services":{
        "count": <number>,
        "families": [<slug>,...]
    },
    "Apps":{
        "count": <number>,
        "families": [<slug>,...]
    },
}
```

5. `GET /plugin-full/<slug>/<version>` - returns not-minified resolved version of plugin.
5. `GET /plugin-full/<slug>/<version>/:file` - returns not-minified file.
6. `GET /plugin/<slug>/<version>` - returns minified resolved version of plugin.
7. `GET /plugin/<slug>/<version>/:file` - returns the file minified 

8. `POST /plugin/<slug>/<version>` - checks if same exists -  
if yes - returns error msg.  
if no - add metaJSON to registry
```json
//body - metajson
```

9.  `GET /verify/local-registry` - reconciles local `meta.json` files with the local registry
        - adds any missing local meta rows
        - marks `invalid_flag=true` for registry rows where local meta was deleted
        ```json
        //Response
        {
            "ok": true,
            "message": "local registry verification complete",
            "data": {
                "scannedCount": 8,
                "parseErrors": [],
                "insertedCount": 1,
                "updatedCount": 7,
                "markedInvalidCount": 2,
                "revalidatedCount": 1,
                "invalidTotal": 2
            }
        }
        ```

### Optional Query Flag
- `GET /meta`, `GET /meta/:slug`, `GET /meta/:slug/:version`
    - query: `includeInvalid=true` to include invalidated local rows
        ```txt
        /meta/widget%3Edesign-system%3EAtom.demo?includeInvalid=true
        ```



# Working
1. Server runs on constant port (use 3005) - use Bun.serve()
2. onBootup   
   - create/use a database with all available meta.json files  
   - key - `<slug> + <version>`
   - capable of `GET /meta` page, filter and sort operations

## Registry Storage (v1)
1. Registry database: `registry/registry.sqlite3` (Bun SQLite).
2. SQLite side files like `registry.sqlite3-wal` and `registry.sqlite3-shm` may be created by runtime.
3. `POST /plugin/:slug/:version` stores entries in SQLite as `source_type=posted`.
4. Local file derived entries are stored as `source_type=local` and reconciled via `GET /verify/local-registry`.
5. In v1, `/plugin` returns minified file content and `/plugin-full` returns original content.

## Home Page (v1)
1. `GET /` serves the Home assets via Router home handler.
2. Home displays API list and simple metadata explorer (search/filter/sort).
3. Home does not include widget playground in this version.
```json
//Registry JSON sample format
{
    // <slug>:<version>:<metaFileContent>
    //example =>
    "widget>design-system>Atom.input":{
        "1.0.0": {
            "name": "Input",
            "version": "1.0.0",
            "slug": "widget>design-system>Atom.input",
            "description": "An input component for consistent UI development.",
            "baseURL": "Data/Widgets/DesignSystem/Atoms/Input/Core",
            "baseType": "local",
            "files": [
                {"url": "${baseURL}/Input.js", "entry": true},
                {"url": "${baseURL}/Input.html"},
                {"url": "${baseURL}/Input.css"}
            ]
        }
    }
}

```

