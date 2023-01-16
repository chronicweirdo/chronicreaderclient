importScripts('crypto-js.js')
importScripts('jszip.js')
importScripts('libunrar.js')
importScripts('reader.js')
importScripts('readerextensions.js')

self.addEventListener('install', e => {
    console.log("installing service worker")
})

self.addEventListener('fetch', e => {
    console.log(e.request)
    var url = new URL(e.request.url)
    var worker = new Worker()

    if (url.pathname.match(/\/upload/)) {
        e.respondWith(worker.handleUpload(e.request))
    } else if (url.pathname.match(/\/books/)) {
        e.respondWith(worker.loadAllBooks())
    } else if (url.pathname.match(/\/bookmeta/)) {
        e.respondWith(worker.loadBookMeta(e.request))
    } else if (url.pathname.match(/\/book\//)) {
        e.respondWith(worker.loadContent(e.request))
    } else if (url.pathname.match(/\/sync\//)) {
        e.respondWith(worker.syncProgress(e.request))
    } else if (url.pathname.match(/\/search/)) {
        e.respondWith(worker.searchServer(e.request))
    } else if (url.pathname.match(/\/login/)) {
        e.respondWith(worker.login(e.request))
    } else if (url.pathname.match(/\/download/)) {
        e.respondWith(worker.handleDownload(e.request))
    } else if (url.pathname.match(/\/delete/)) {
        e.respondWith(worker.handleDelete(e.request))
    } else if (url.pathname.match(/\/verify/)) {
        e.respondWith(worker.handleVerify(e.request))
    } else if (url.pathname.match(/\/collections/)) {
        e.respondWith(worker.handleCollections(e.request))
    } else if (url.pathname.match(/\/setting\//) && e.request.method == "GET") {
        e.respondWith(worker.loadSetting(e.request))
    } else if (url.pathname.match(/\/setting\//) && e.request.method == "PUT") {
        e.respondWith(worker.saveSetting(e.request))
    } else if (url.pathname.match(/\/settings/) && e.request.method == "DELETE") {
        e.respondWith(worker.deleteSettings(e.request))
    } else {
        e.respondWith(fetch(e.request))
    }
})

class Worker {
    constructor() {

    }

    async deleteSettings(request) {
        try {
            let db = new Database()
            await db.deleteSettings()
            return this.getJsonResponse(true)
        } catch (error) {
            console.log(error)
            return this.getJsonResponse(false)
        }
    }

    async saveSetting(request) {
        //console.log("saving setting")
        let url = new URL(request.url)
        let pathParts = url.pathname.split("/")
        let key = pathParts[pathParts.length - 1]
        let value = await request.text()
        //console.log(key)
        //console.log(value)

        let db = new Database()
        let result = await db.saveSetting(key, value)
        //console.log(result)
        return this.getJsonResponse(result)
    }

    async loadSetting(request) {
        //console.log("loading setting")
        let url = new URL(request.url)
        let pathParts = url.pathname.split("/")
        let key = pathParts[pathParts.length - 1]
        //console.log(key)

        let db = new Database()
        let result = await db.loadSetting(key)
        //console.log(result)
        if (result != null) {
            return this.getJsonResponse(result.value)
        } else {
            return this.get404Response()
        }
    }

    async login(request) {
        let body = await request.json()
    
        let backend = new Backend(body.server, null)
        let loginResult = await backend.login(body.server, body.username, body.password)
    
        await this.updateLocalBooks()
    
        return this.getJsonResponse(loginResult)
    }

    async handleDownload(request) {
        let url = new URL(request.url)
        let pathParts = url.pathname.split("/")
        let bookId = pathParts[pathParts.length - 1]
        let chunked = url.searchParams.get("chunked") != null
    
        // get meta from backend
        let backend = await Backend.factory()
        let bookMeta = await backend.getMeta(bookId)
        if (bookMeta != null) {
            // save meta to db
            let downloadedChunked = false
            let db = new Database()
            try {
                if (chunked || bookMeta.chunked) {
                    downloadedChunked = true
                    // download chunk files
                    let filesResponse = await backend.getContent(bookMeta.id, true)
                    if (filesResponse.status == 200) {
                        let filesBytes = await filesResponse.arrayBuffer()
                        db.saveFileListContent(bookMeta.id, filesBytes)
                        let dec = new TextDecoder("utf-8")
                        let text = dec.decode(new Uint8Array(filesBytes))
                        let files = JSON.parse(text)
                        for (let filename of files) {
                            let fileResponse = await backend.getContent(bookMeta.id, null, filename)
                            if (fileResponse.status == 200) {
                                let fileBytes = await fileResponse.arrayBuffer()
                                db.saveFileContent(bookMeta.id, filename, fileBytes)
                            } else {
                                throw "failed to download file " + filename
                            }
                        }
                    } else {
                        throw "failed to download file list"
                    }
                } else {
                    let contentResponse = await backend.getContent(bookMeta.id)
                    if (contentResponse.status == 200) {
                        let bytes = await contentResponse.arrayBuffer()
                        await db.saveContent(bookMeta.id, bytes)
                    } else {
                        throw "failed to download archive"
                    }
                }
                // save meta at the end only
                await db.saveMeta({
                    id: bookMeta.id,
                    title: bookMeta.title,
                    extension: bookMeta.extension,
                    collection: bookMeta.collection,
                    size: bookMeta.size,
                    filesize: bookMeta.filesize,
                    cover: bookMeta.cover,
                    chunked: downloadedChunked
                })
                return this.getJsonResponse(true)
            } catch (err) {
                console.log(err)
                return this.getJsonResponse(false)
            }
            
        }
        return this.getJsonResponse(false)
    }

    async syncProgress(request) {
        let url = new URL(request.url)
        let pathParts = url.pathname.split("/")
        let bookId = pathParts[pathParts.length - 1]
        let params = new URLSearchParams(url.search)
        let progress = params.get("position")
        let completed = (params.get("completed") != undefined) ? (params.get("completed") === "true") : null
        console.log("sync " + progress + " " + completed)
    
        if (progress) {
            // save progress
            let now = new Date()
            let dbSaveResult = false
            try {
                let db = new Database()
                dbSaveResult = await db.updateProgress(bookId, now, progress, completed)
            } catch (error) {
                console.log(error)
            }
            // todo: sync progress with backend if it exists
            let backend = await Backend.factory()
            let backendSaveResult = await backend.updateProgress(bookId, now, progress, completed)
            return this.getJsonResponse(dbSaveResult)
        } else {
            let progress = await this.getProgressForBook(bookId)
            return this.getJsonResponse(progress)
        }
    }

    async handleUpload(request) {
        let filename = request.headers.get('filename')
        let extension = getFileExtension(filename)
        let title = filename.substring(0, filename.length - extension.length - 1)
        let bytes = await request.arrayBuffer()
    
        let hash = this.getArrayBufferSHA256(bytes)
    
        let cover = null
        let size = null
        try {
            let archive = ArchiveWrapper.factory(extension, new Blob([bytes]))
            let book = BookWrapper.factory(hash, archive, extension)
            cover = await book.getCover()
            size = await book.getSize()
        } catch(error) {
            console.log(error)
            return this.getJsonResponse(false)
        }
    
        // try to get information from server
        let collection = null
        try {
            let backend = await Backend.factory()
            let meta = await backend.getMeta(hash)
            if (meta != null) {
                collection = meta.collection
                title = meta.title
            }
        } catch (error) {
            console.log(error)
        }
    
        let db = new Database()
        let savedContent = await db.saveContent(hash, bytes)
        let savedValue = await db.saveMeta({
            id: hash, 
            title: title, 
            extension: extension, 
            collection: collection,
            size: size,
            filesize: bytes.byteLength,
            cover: cover,
            chunked: false
        })
    
        return this.getJsonResponse(savedContent && savedValue)
    }

    async loadAllBooks() {
        let db = new Database()
        let databaseBooks = await db.loadAllMetas()
        for (let book of databaseBooks) {
            let progress = await this.getProgressForBook(book.id)
            if (progress) {
                book.position = progress.position
                book.updated = progress.updated
                book.completed = progress.completed
            }
        }
        return this.getJsonResponse(databaseBooks)
    }

    async loadBookMeta(request) {
        let url = new URL(request.url)
        let pathParts = url.pathname.split("/")
        let bookId = pathParts[pathParts.length - 1]
    
        let db = new Database()
        let bookObject = await db.loadMeta(bookId)
        if (bookObject == null) {
            let backend = await Backend.factory()
            let meta = await backend.getMeta(bookId)
            if (meta != null) {
                bookObject = meta
            }
        }
        if (bookObject != null) {
            let progress = await this.getProgressForBook(bookId)
            bookObject.position = progress.position
            bookObject.updated = progress.updated
            bookObject.completed = progress.completed
            return this.getJsonResponse(bookObject)
        } else {
            return this.get404Response()
        }
    }

    async loadContent(request) {
        let url = new URL(request.url)
        let pathParts = url.pathname.split("/")
        let bookId = pathParts[pathParts.length - 1]
        let files = url.searchParams.get("files")
        let filename = url.searchParams.get("filename")
    
        if (files) {
            let db = new Database()
            let filesContent = await db.loadContentList(bookId)
            if (filesContent) {
                return new Response(filesContent.content, { status: 200 })
            } else {
                let backend = await Backend.factory()
                return await backend.getContent(bookId, files = true)
            }
        } else if (filename) {
            let db = new Database()
            let fileContent = await db.loadContentFile(bookId, filename)
            if (fileContent) {
                return new Response(fileContent.content, { status: 200 })
            } else {
                let backend = await Backend.factory()
                return await backend.getContent(bookId, null, filename)
            }
        } else {
            // check locally for book
            let db = new Database()
            let bookObject = await db.loadContent(bookId)
            if (bookObject) {
                return new Response(bookObject.content, { status: 200 })
            } else {
                // check for book on server
                let backend = await Backend.factory()
                return await backend.getContent(bookId)
            }
        }
    }

    async searchServer(request) {
        let url = new URL(request.url)
        let params = new URLSearchParams(url.search)
        let term = params.get("term")
        let page = Number(params.get("page"))
        let pageSize = Number(params.get("pageSize"))
        let order = params.get("order")
        let completed = params.get("completed")
    
        let backend = await Backend.factory()
        let searchResult = await backend.search(term, page, pageSize, order, completed)
        if (searchResult != null) {
            return this.getJsonResponse(searchResult)
        } else {
            return this.get404Response()
        }
    }

    async handleDelete(request) {
        let url = new URL(request.url)
        let pathParts = url.pathname.split("/")
        let bookId = pathParts[pathParts.length - 1]
    
        let db = new Database()
        let deleteResult = await db.deleteBook(bookId)
        if (deleteResult) {
            return this.getJsonResponse(true)
        }
        return this.getJsonResponse(false)
    }

    async handleVerify(request) {
        let backend = await Backend.factory()
        let result = await backend.verifyConnection()
        return this.getJsonResponse(result)
    }
    
    async handleCollections(request) {
        let backend = await Backend.factory()
        let result = await backend.loadCollections()
        return this.getJsonResponse(result)
    }

    async updateLocalBooks() {
        let db = new Database()
        let backend = await Backend.factory()
        let localBookMetas = await db.loadAllMetas()
        for (let book of localBookMetas) {
            let backendMeta = await backend.getMeta(book.id)
            if (backendMeta != null) {
                let localBook = await db.loadMeta(book.id)
                await db.saveMeta({
                    id: localBook.id, 
                    title: backendMeta.title,
                    extension: localBook.extension, 
                    collection: backendMeta.collection, 
                    size: localBook.size,
                    filesize: backendMeta.filesize,
                    cover: backendMeta.cover,
                    chunked: localBook.chunked != undefined ? localBook.chunked : false
                })
            }
        }
    }

    async getProgressForBook(bookId) {
        // load progress from backend, if it exists
        let backend = await Backend.factory()
        let backendProgress = await backend.getProgress(bookId)
        console.log("backend progress")
        console.log(backendProgress)
    
        // load progress from database
        let db = new Database()
        let databaseProgress = await db.loadProgress(bookId)
        console.log("database progress")
        console.log(databaseProgress)
    
        if (backendProgress != null && databaseProgress != null) {
            // use the latest progress
            if (backendProgress.updated > databaseProgress.updated) {
                return backendProgress
            } else {
                return databaseProgress
            }
        } else if (backendProgress != null) {
            // save backend progress to local db and return it
            let res = await db.updateProgress(backendProgress.id, backendProgress.updated, backend.position, backend.completed)
            return backendProgress
        } else if (databaseProgress != null) {
            let res = await backend.updateProgress(databaseProgress.id, databaseProgress.updated, databaseProgress.position, databaseProgress.completed)
            return databaseProgress
        } else {
            // we have no progress info, default position is 0
            return {
                id: bookId,
                updated: new Date(),
                position: 0,
                completed: false
            }
        }
    }
    
    get404Response() {
        return new Response("", { "status" : 404 })
    }
    
    getJsonResponse(json) {
        const hdrs = new Headers()
        hdrs.append('Content-Type', 'application/json')
        const jsonString = JSON.stringify(json)
        return new Response(jsonString, {
            status: 200,
            headers: hdrs
        })
    }
    
    getArrayBufferSHA256(bytes) {
        const SLICE_SIZE = 50000000
        let algo = CryptoJS.algo.SHA256.create()
        for (let i = 0; i < bytes.byteLength / SLICE_SIZE; i++) {
            let start = i * SLICE_SIZE
            let end = Math.min((i+1) * SLICE_SIZE, bytes.byteLength)
            let bytesSlice = bytes.slice(start, end)
            let wordArray = CryptoJS.lib.WordArray.create(bytesSlice)
            algo.update(wordArray)
        }
        algo.finalize()
        let hash = algo._hash.toString()
        return hash
    }
}

class Database {
    static DATABASE_NAME = "chronicreaderclient"
    static DATABASE_VERSION = "4"
    static PROGRESS_TABLE = 'progress'
    static CONNECTION_TABLE = 'connection'
    static META_TABLE = "meta"
    static CONTENT_TABLE = "content"
    static SETTING_TABLE = "setting"

    constructor() {

    }

    getDb() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(Database.DATABASE_NAME, Database.DATABASE_VERSION)
            request.onerror = function(event) {
                console.log("failed to open database")
                reject()
            }
            request.onsuccess = function(event) {
                resolve(event.target.result)
            }
            request.onupgradeneeded = function(event) {
                try {
                    console.log("upgrading database")
                    let localDb = event.target.result
                    let progressStore = localDb.createObjectStore(Database.PROGRESS_TABLE, {keyPath: 'id'})
                    let connectionStore = localDb.createObjectStore(Database.CONNECTION_TABLE, {keyPath: 'id'})
                    let metaStore = localDb.createObjectStore(Database.META_TABLE, {keyPath: 'id'})
                    let contentStore = localDb.createObjectStore(Database.CONTENT_TABLE, {keyPath: 'id'})
                    let settingStore = localDb.createObjectStore(Database.SETTING_TABLE, {keyPath: 'id'})
                    console.log("upgraded")
                    resolve(localDb)
                } catch (error) {
                    console.log("failed to upgrade database")
                    console.log(error)
                    reject(error)
                }
            }
        })
    }

    databaseSave(table, value) {
        return new Promise((resolve, reject) => {
            this.getDb().then(db => {
                let transaction = db.transaction([table], "readwrite")
                transaction.oncomplete = function(event) {
                    resolve(value)
                }
                let objectStore = transaction.objectStore(table)
                value['date'] = new Date()
                let addRequest = objectStore.put(value)
            })
        })
    }
    
    databaseLoad(table, key, columns = null) {
        return new Promise((resolve, reject) => {
            this.getDb().then(db => {
                let transaction = db.transaction([table])
                let objectStore = transaction.objectStore(table)
                let dbRequest = objectStore.get(key)
                dbRequest.onsuccess = function(event) {
                    if (event.target.result) {
                        if (columns != null) {
                            let obj = {}
                            obj["id"] = event.target.result["id"]
                            for (let c = 0; c < columns.length; c++) {
                                obj[columns[c]] = event.target.result[columns[c]]
                            }
                            resolve(obj)
                        } else {
                            resolve(event.target.result)
                        }
                    } else {
                        resolve(null)
                    }
                }
                dbRequest.onerror = function(event) {
                    reject()
                }
            })
        })
    }
    
    databaseLoadAll(table) {
        return new Promise((resolve, reject) => {
            this.getDb().then(db => {
                let transaction = db.transaction([table])
                let objectStore = transaction.objectStore(table)
                let dbRequest = objectStore.getAll()
                dbRequest.onsuccess = function(event) {
                    if (event.target.result) {
                        resolve(event.target.result)
                    } else {
                        resolve()
                    }
                }
                dbRequest.onerror = function(event) {
                    reject()
                }
            })
        })
    }

    databaseDelete(table, key) {
        return new Promise((resolve, reject) => {
            this.getDb().then(db => {
                let transaction = db.transaction([table], 'readwrite')
                let objectStore = transaction.objectStore(table)
                let dbRequest = objectStore.delete(key)
                dbRequest.onsuccess = function(event) {
                    resolve(true)
                }
                dbRequest.onerror = function(event) {
                    reject()
                }
            })
        })
    }
    
    databaseDeleteAll(table) {
        return new Promise((resolve, reject) => {
            this.getDb().then(db => {
                let transaction = db.transaction([table], "readwrite")
                let objectStore = transaction.objectStore(table)
                let dbRequest = objectStore.clear()
                dbRequest.onsuccess = (event) => {
                    resolve()
                }
                dbRequest.onerror = (event) => {
                    reject()
                }
            })
        })
    }
    
    databaseLoadColumns(table, key, columns) {
        return new Promise((resolve, reject) => {
            this.getDb().then(db => {
                let transaction = db.transaction([table])
                let objectStore = transaction.objectStore(table)
                let cursorRequest = objectStore.openCursor()
    
                let result = []
                cursorRequest.onsuccess = event => {
                    let cursor = event.target.result
                    if (cursor) {
                        let obj = {}
                        obj[key] = cursor.value[key]
                        for (let c = 0; c < columns.length; c++) {
                            obj[columns[c]] = cursor.value[columns[c]]
                        }
                        result.push(obj)
                        cursor.continue()
                    } else {
                        resolve(result)
                    }
                }
                cursorRequest.onerror = event => reject()
            })
        })
    }

    async loadToken() {
        let connections = await this.databaseLoadAll(Database.CONNECTION_TABLE)
        if (connections.length >= 1) {
            let connection = connections[0]
            return {
                server: connection.id,
                username: connection.username,
                token: connection.token
            }
        }
        return {
            server: null,
            token: null
        }
    }

    async saveSetting(key, value) {
        try {
            await this.databaseSave(Database.SETTING_TABLE, {
                id: key,
                value: value
            });
            return true;
        } catch (error) {
            console.log(error);
            return false;
        }
    }

    async loadSetting(key) {
        try {
            let setting = await this.databaseLoad(Database.SETTING_TABLE, key, ["value"]);
            return setting;
        } catch (error) {
            return null;
        }
    }

    async saveToken(server, username, token) {
        let deletedResult = await this.databaseDeleteAll(Database.CONNECTION_TABLE)
        let savedResult = await this.databaseSave(Database.CONNECTION_TABLE, {
            id: server,
            username: username,
            token: token
        })
    }

    async deleteSettings() {
        await this.databaseDeleteAll(Database.SETTING_TABLE)
    }

    async deleteBook(id) {
        try {
            let contentIds = await this.#loadAllContentForId(id)
            for (let contentId of contentIds) {
                await this.databaseDelete(Database.CONTENT_TABLE, contentId)
            }
            await this.databaseDelete(Database.META_TABLE, id)
            return true
        } catch (err) {
            console.log(err)
            return false
        }
    }

    async saveMeta(meta) {
        let saveResult = await this.databaseSave(Database.META_TABLE, meta)
        if (saveResult != undefined && saveResult != null) {
            return true
        } else {
            return false
        }
    }

    static CONTENT_TYPE_FULL = "full"
    static CONTENT_TYPE_LIST = "list"
    static CONTENT_TYPE_FILE = "file"
    #getContentId(id, type, filename) {
        if (type == Database.CONTENT_TYPE_FULL) {
            return id
        } else if (type == Database.CONTENT_TYPE_LIST) {
            return id + "/*"
        } else if (type == Database.CONTENT_TYPE_FILE && filename != null) {
            return id + "/" + filename
        } else {
            return null
        }
    }
    async #saveContentInternal(id, content, type = Database.CONTENT_TYPE_FULL, filename = null) {
        if (filename != null) {
            type = Database.CONTENT_TYPE_FILE
        }
        let contentId = this.#getContentId(id, type, filename)
        if (contentId == null) return false
        let contentEntry = {
            id: contentId,
            content: content
        }
        let saveResult = await this.databaseSave(Database.CONTENT_TABLE, contentEntry)
        if (saveResult != undefined && saveResult != null) {
            return true
        } else {
            return false
        }
    }
    async saveContent(id, content) {
        return this.#saveContentInternal(id, content)
    }
    async saveFileListContent(id, content) {
        return this.#saveContentInternal(id, content, Database.CONTENT_TYPE_LIST)
    }
    async saveFileContent(id, filename, content) {
        return this.#saveContentInternal(id, content, Database.CONTENT_TYPE_FILE, filename)
    }

    async updateProgress(bookId, updated, progress, completed) {
        let currentProgress = await this.loadProgress(bookId)
        console.log("current db progress: " + JSON.stringify(currentProgress))
        if (currentProgress != undefined && currentProgress != null) {
            if (currentProgress.updated < updated) {
                let updatedProgress = await this.databaseSave(Database.PROGRESS_TABLE, {
                    "id": bookId,
                    "updated": updated,
                    "position": Number(progress),
                    "completed": completed != null ? completed : currentProgress.completed
                })
                if (updatedProgress != undefined && updatedProgress != null) {
                    return true
                } else {
                    return false
                }
            } else {
                return false
            }
        } else {
            let newProgress = await this.databaseSave(Database.PROGRESS_TABLE, {
                "id": bookId,
                "updated": updated,
                "position": Number(progress),
                "completed": completed
            })
            if (newProgress != undefined && newProgress != null) {
                return true
            } else {
                return false
            }
        }
    }

    async loadProgress(bookId) {
        return await this.databaseLoad(Database.PROGRESS_TABLE, bookId)
    }

    async loadMeta(id) {
        let bookMeta = await this.databaseLoad(Database.META_TABLE, id)
        if (bookMeta) {
            bookMeta.local = true
        }
        return bookMeta
    }

    async #loadAllContentForId(id) {
        let content = await this.databaseLoadColumns(Database.CONTENT_TABLE, "id", [])
        let contentIds = content.map(o => o.id).filter(oid => oid.startsWith(id))
        return contentIds
    }

    async #loadContentInternal(id, type, filename = null) {
        let contentId = this.#getContentId(id, type, filename)
        if (contentId) {
            let content = await this.databaseLoad(Database.CONTENT_TABLE, contentId)
            return content
        } else {
            return null
        }
    }

    async loadContent(id) {
        return this.#loadContentInternal(id, Database.CONTENT_TYPE_FULL)
    }

    async loadContentList(id) {
        return this.#loadContentInternal(id, Database.CONTENT_TYPE_LIST)
    }

    async loadContentFile(id, filename) {
        return this.#loadContentInternal(id, Database.CONTENT_TYPE_FILE, filename)
    }

    async loadAllMetas() {
        let metas = await this.databaseLoadAll(Database.META_TABLE)
        return Array.from(metas)
    }
}





class Backend {
    static async factory() {
        let {server, username, token} = await Backend.loadToken()
        return new Backend(server, username, token)
    }
    constructor(server, username, token) {
        this.server = server
        this.username = username
        this.token = token
    }
    static async loadToken() {
        let db = new Database()
        return await db.loadToken()
    }
    static async saveToken(server, username, token) {
        let db = new Database()
        return await db.saveToken(server, username, token)
    }
    async login(server, username, password) {
        try {
            let url = server + "/login"
            let body = JSON.stringify({username: username, password: password})
            let loginResponse = await fetch(url, { 
                method: 'POST', 
                body: body,
                headers: { 'Content-Type': 'application/json'}
            })
            if (loginResponse.status == 200) {
                let responseJson = await loginResponse.json()
                let serverUsername = responseJson.data.username
                let token = responseJson.data.token
                await Backend.saveToken(server, serverUsername, token)
                this.server = server
                this.token = token
                return true
            } else {
                return false
            }
        } catch (error) {
            console.log(error)
            return false
        }
    }

    getAuthHeaders(contentType = null) {
        let headers = { 'Authorization': 'Bearer ' + this.token}
        if (contentType != null) {
            headers["Content-Type"] = contentType
        }
        return headers
    }

    async search(term, page, pageSize, order, completed) {
        try {
            let searchParams = {}
            if (term == undefined || term == null) {
                searchParams.term = ""
            } else {
                searchParams.term = term
            }
            if (page == undefined || page == null) {
                searchParams.page = 0
            } else {
                searchParams.page = page
            }
            if (pageSize == undefined || pageSize == null) {
                searchParams.pageSize = 10
            } else {
                searchParams.pageSize = pageSize
            }
            if (order == undefined || order == null) {
                searchParams.order = ""
            } else {
                searchParams.order = order
            }
            if (completed != undefined && completed != null) {
                searchParams.completed = completed
            }
            let url = this.server + "/search?" + new URLSearchParams(searchParams)
            let response = await fetch(url, {
                headers: this.getAuthHeaders()
            })
            if (response.status == 200) {
                let result = await response.json()
                return result
            } else {
                return null
            }
        } catch (error) {
            console.log(error)
            return null
        }
    }

    async loadCollections() {
        try {
            let response = await fetch(this.server + "/collections", { headers: this.getAuthHeaders() })
            if (response.status == 200) {
                let result = await response.json()
                return result
            } else {
                return null
            }
        } catch (error) {
            console.log(error)
            return null
        }
    }

    async getContent(bookId, files = null, filename = null) {
        try {
            let url = this.server + "/content/" + bookId
            if (files) {
                url += "?" + new URLSearchParams({"files": null})
            } else if (filename) {
                url += "?" + new URLSearchParams({"filename": filename})
            }
            let response = await fetch(url, {headers: this.getAuthHeaders()})
            return response
        } catch (error) {
            console.log(error)
            return new Worker().get404Response()
        }
    }

    async verifyConnection() {
        try {
            let url = this.server + "/verify"
            let response = await fetch(url, {headers: this.getAuthHeaders()})
            if (response.status == 200) {
                let responseContent = await response.json()
                return {
                    server: this.server,
                    username: this.username,
                    code: 200,
                    connected: responseContent
                }
            } else {
                return {
                    server: this.server,
                    username: this.username,
                    code: response.status,
                    connected: false
                }
            }
        } catch (error) {
            console.log(error)
            return {
                server: this.server,
                username: this.username,
                error: error.message,
                connected: false
            }
        }
    }

    async getMeta(bookId) {
        try {
            let url = this.server + "/book/" + bookId
            let response = await fetch(url, {headers: this.getAuthHeaders()})
            if (response.status == 200) {
                let responseJson = await response.json()
                return responseJson
            } else {
                return null
            }
        } catch (error) {
            console.log(error)
            return null
        }
    }

    async getProgress(bookId) {
        try {
            let url = this.server + "/progress/" + bookId
            let response = await fetch(url, {headers: this.getAuthHeaders()})
            if (response.status == 200) {
                let progressJson = await response.json()
                return {
                    id: bookId,
                    updated: new Date(progressJson.updated),
                    position: progressJson.position,
                    completed: progressJson.completed
                }
            } else {
                return null
            }
        } catch (error) {
            console.log(error)
            return null
        }
    }

    async updateProgress(bookId, updated, position, completed) {
        try {
            let url = this.server + "/progress/" + bookId
            let body = {
                position: position,
                updated: updated
            }
            if (completed != undefined && completed != null) {
                body.completed = completed
            }
            let response = await fetch(url, {
                method: 'PUT', 
                body: JSON.stringify(body),
                headers: this.getAuthHeaders("application/json")
            })
            if (response.status == 200) {
                return true
            } else {
                return false
            }
        } catch (error) {
            console.log(error)
            return false
        }
    }

    getRemoteArchive(bookId) {
        return new RemoteArchive(this.server + "/archive", bookId, this.getAuthHeaders())
    }
}