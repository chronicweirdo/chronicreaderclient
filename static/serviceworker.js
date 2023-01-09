importScripts('crypto-js.js')
importScripts('jszip.js')
importScripts('libunrar.js')
importScripts('reader.js')
importScripts('readerextensions.js')

self.addEventListener('install', e => {
    console.log("installing service worker")
})

self.addEventListener('fetch', e => {
    var url = new URL(e.request.url)
    console.log("pathname: " + url.pathname)

    if (url.pathname.match(/\/upload/)) {
        e.respondWith(handleUpload(e.request))
    } else if (url.pathname.match(/\/books/)) {
        e.respondWith(loadAllBooks())
    } else if (url.pathname.match(/\/bookmeta/)) {
        e.respondWith(loadBookMeta(e.request))
    } else if (url.pathname.match(/\/book\//)) {
        e.respondWith(loadBook(e.request))
    } else if (url.pathname.match(/\/sync\//)) {
        e.respondWith(syncProgress(e.request))
    } else if (url.pathname.match(/\/search/)) {
        e.respondWith(searchServer(e.request))
    } else if (url.pathname.match(/\/login/)) {
        e.respondWith(login(e.request))
    } else if (url.pathname.match(/\/download/)) {
        e.respondWith(handleDownload(e.request))
    } else if (url.pathname.match(/\/delete/)) {
        e.respondWith(handleDelete(e.request))
    } else if (url.pathname.match(/\/verify/)) {
        e.respondWith(handleVerify(e.request))
    } else if (url.pathname.match(/\/archive\//)) {
        e.respondWith(handleArchive(e.request))
    } else {
        e.respondWith(fetch(e.request))
    }
})

class Database {
    static DATABASE_NAME = "chronicreaderclient"
    static DATABASE_VERSION = "3"
    static FILE_TABLE = 'files'
    static PROGRESS_TABLE = 'progress'
    static CONNECTION_TABLE = 'connection'
    static BOOK_META = ["title", "extension", "collection", "size", "cover"]

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
                console.log("successfully opened database")
                resolve(event.target.result)
            }
            request.onupgradeneeded = function(event) {
                try {
                    console.log("upgrading database")
                    console.log(event)
                    let localDb = event.target.result
                    let imagesStore = localDb.createObjectStore(Database.FILE_TABLE, {keyPath: 'id'})
                    let progressStore = localDb.createObjectStore(Database.PROGRESS_TABLE, {keyPath: 'id'})
                    let connectionStore = localDb.createObjectStore(Database.CONNECTION_TABLE, {keyPath: 'id'})
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
                console.log("obtained db")
                console.log(db)
                let transaction = db.transaction([table], "readwrite")
                console.log("obtained transaction")
                transaction.oncomplete = function(event) {
                    console.log("save transaction complete")
                    resolve(value)
                }
                let objectStore = transaction.objectStore(table)
                value['date'] = new Date()
                console.log("saving value:")
                console.log(value)
                let addRequest = objectStore.put(value)
                addRequest.onsuccess = (event) => {
                    console.log("add request successful")
                }
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
                        resolve()
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
                //transaction.oncomplete = () => resolve(true)
                dbRequest.onsuccess = function(event) {
                    console.log("deleted")
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
                    console.log(event)
                    resolve()
                }
                dbRequest.onerror = (event) => {
                    console.log(event)
                    reject()
                }
            })
        })
    }

    /* aparently need to resave the full object, so this will not work
    databaseUpdate(table, key, value) {
        return new Promise((resolve, reject) => {
            this.getDb().then(db => {
                let transaction = db.transaction([table, "readwrite"])
                let objectStore = transaction.objectStore(table)
                let dbRequest = objectStore.get(key)
            })
        })
    }*/
    
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
    async saveToken(server, username, token) {
        console.log("deleting old token")
        let deletedResult = await this.databaseDeleteAll(Database.CONNECTION_TABLE)
        console.log("saving new token")
        let savedResult = await this.databaseSave(Database.CONNECTION_TABLE, {
            id: server,
            username: username,
            token: token
        })
    }

    async deleteBook(id) {
        return await this.databaseDelete(Database.FILE_TABLE, id)
    }

    async saveBook(id, title, extension, collection, size, cover, content) {
        let dbFile = {
            "id": id,
            "title": title,
            "extension": extension,
            "collection": collection,
            "size": size,
            "cover": cover,
            "content": content
        }
        let saveResult = await this.databaseSave(Database.FILE_TABLE, dbFile)
        if (saveResult != undefined && saveResult != null) {
            return true
        } else {
            return false
        }
    }

    async saveProgress(bookId, updated, progress) {
        return await this.databaseSave(Database.PROGRESS_TABLE, {
            "id": bookId,
            "updated": updated,
            "position": progress
        })
    }

    async loadProgress(bookId) {
        return await this.databaseLoad(Database.PROGRESS_TABLE, bookId)
    }

    async loadBookMeta(bookId) {
        let book = await this.databaseLoad(Database.FILE_TABLE, bookId, Database.BOOK_META)
        if (book) {
            book.local = true
        }
        return book
    }

    async loadBook(bookId) {
        let book = await this.databaseLoad(Database.FILE_TABLE, bookId)
        if (book) {
            book.local = true
        }
        return book
    }

    async loadAllBookMetas() {
        let books = await this.databaseLoadColumns(Database.FILE_TABLE, "id", Database.BOOK_META)
        console.log(books)
        return Array.from(books)
    }
}



function get200Response() {
    return new Response("", { "status" : 200 })
}

function get401Response() {
    return new Response("", { "status" : 401 })
}

function get404Response() {
    return new Response("", { "status" : 404 })
}

function get500Response() {
    return new Response("", { "status" : 500 })
}

function getJsonResponse(json) {
    const hdrs = new Headers()
    hdrs.append('Content-Type', 'application/json')
    const jsonString = JSON.stringify(json)
    return new Response(jsonString, {
        status: 200,
        headers: hdrs
    })
}

function getTextResponse(text) {
    const hdrs = new Headers()
    hdrs.append('Content-Type', 'text/plain')
    return new Response(text, {
        status: 200,
        headers: hdrs
    })
}

function buf2hex(buffer) { // buffer is an ArrayBuffer
    return [...new Uint8Array(buffer)]
        .map(x => x.toString(16).padStart(2, '0'))
        .join('');
}

function getArrayBufferSHA256(bytes) {
    /*if (typeCheck(bytes) == "arraybuffer") {
        bytes = Uint8Array([bytes])
    }*/
    /*console.log(typeCheck(bytes))
    console.log("file size: " + bytes.length)
    console.log("file size: " + bytes.byteLength)*/
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
    let hash = algo._hash.toString()//CryptoJS.SHA256(wordArray).toString()
    return hash
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

    async search(term, page, pageSize, order) {
        try {
            if (term == undefined || term == null) {
                term = ""
            }
            if (page == undefined || page == null) {
                page = 0
            }
            if (pageSize == undefined || pageSize == null) {
                pageSize = 10
            }
            if (order == undefined || order == null) {
                order = ""
            }
            let url = this.server + "/search?" + new URLSearchParams({
                term: term,
                page: page,
                pageSize: pageSize,
                order: order
            })
            console.log("search " + url)
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

    async getContent(bookId) {
        try {
            let url = this.server + "/content/" + bookId
            let response = await fetch(url, {headers: this.getAuthHeaders()})
            return response
        } catch (error) {
            console.log(error)
            return get404Response()
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
                    position: progressJson.position
                }
            } else {
                return null
            }
        } catch (error) {
            console.log(error)
            return null
        }
    }

    async saveProgress(bookId, updated, position) {
        try {
            let url = this.server + "/progress/" + bookId // + "/" + position
            let body = JSON.stringify({
                position: position,
                updated: updated
            })
            let response = await fetch(url, {
                method: 'PUT', 
                body: body,
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

async function handleVerify(request) {
    let backend = await Backend.factory()
    let result = await backend.verifyConnection()
    return getJsonResponse(result)
}

async function login(request) {
    let body = await request.json()

    let backend = new Backend(body.server, null)
    let loginResult = await backend.login(body.server, body.username, body.password)
    console.log("login result: " + loginResult)

    await updateLocalBooks()

    return getJsonResponse(loginResult)
}

async function updateLocalBooks() {
    console.log("updating local books")

    let db = new Database()
    let backend = await Backend.factory()
    let localBookMetas = await db.loadAllBookMetas()
    for (let book of localBookMetas) {
        console.log("updating local book " + book.title)
        let backendMeta = await backend.getMeta(book.id)
        if (backendMeta != null) {
            console.log("backend meta")
            console.log(backendMeta)
            let localBook = await db.loadBook(book.id)
            console.log("local book " + localBook.title + " collection " + localBook.collection)
            await db.saveBook(
                localBook.id, 
                backendMeta.title, 
                localBook.extension, 
                backendMeta.collection, 
                localBook.size, 
                backendMeta.cover, 
                localBook.content
            )
        }
    }
}

async function handleDelete(request) {
    let url = new URL(request.url)
    let pathParts = url.pathname.split("/")
    let bookId = pathParts[pathParts.length - 1]
    console.log("deleting " + bookId)

    let db = new Database()
    let deleteResult = await db.deleteBook(bookId)
    console.log(deleteResult)
    if (deleteResult) {
        return getJsonResponse(true)
    }
    return getJsonResponse(false)
}

async function handleDownload(request) {
    let url = new URL(request.url)
    let pathParts = url.pathname.split("/")
    let bookId = pathParts[pathParts.length - 1]
    console.log("downloading " + bookId)

    // download book from backend
    let backend = await Backend.factory()
    let bookMeta = await backend.getMeta(bookId)
    if (bookMeta != null) {
        let contentResponse = await backend.getContent(bookId)
        console.log(contentResponse)
        if (contentResponse.status == 200) {
            let bytes = await contentResponse.arrayBuffer()

            let db = new Database()
            await db.saveBook(
                bookMeta.id,
                bookMeta.title,
                bookMeta.extension,
                bookMeta.collection,
                bookMeta.size,
                bookMeta.cover,
                bytes
            )

            return getJsonResponse(true)
        }
    }
    return getJsonResponse(false)
}

async function handleUpload(request) {
    let filename = request.headers.get('filename')
    let extension = getFileExtension(filename)
    let title = filename.substring(0, filename.length - extension.length - 1)
    let bytes = await request.arrayBuffer()

    let cover = null
    let size = null
    try {
        let archive = ArchiveWrapper.factory(filename, new Blob([bytes]), extension)
        let book = BookWrapper.factory(archive, extension)
        cover = await book.getCover()
        size = await book.getSize()
    } catch(error) {
        console.log(error)
        return getJsonResponse(false)
    }

    // https://stackoverflow.com/questions/67549348/how-to-create-sha256-hash-from-byte-array-in-javascript
    // compute bytes hash for id
    let hash = getArrayBufferSHA256(bytes)

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
    let savedValue = await db.saveBook(
        hash, 
        title, 
        extension, 
        collection,
        size,
        cover,
        bytes
    )

    return getJsonResponse(savedValue)
}

async function loadAllBooks() {
    let db = new Database()
    let databaseBooks = await db.loadAllBookMetas()
    for (let book of databaseBooks) {
        let progress = await db.loadProgress(book.id)
        if (progress) {
            book.position = progress.position
        }
    }
    return getJsonResponse(databaseBooks)
}

async function handleArchive(request) {
    let url = new URL(request.url)
    let pathParts = url.pathname.split("/")
    let relevantPathParts = []
    for (let i in pathParts) {
        if (pathParts.length - i <= 2) {
            relevantPathParts.push(pathParts[i])
        }
    }
    console.log("relevant path parts: " + relevantPathParts)
    let [bookId, method] = relevantPathParts
    console.log("book id: " + bookId)
    console.log("method: " + method)
    let filename = url.searchParams.get("filename")
    console.log("filename: " + filename)
    
    let backend = await Backend.factory()
    let remoteArchive = backend.getRemoteArchive(bookId)
    if (method == "files") {
        let files = await remoteArchive.getFiles()
        return getJsonResponse(files)
    } else if (method == "base64") {
        let base64 = await remoteArchive.getBase64FileContents(filename)
        return getTextResponse(base64)
    } else if (method == "text") {
        let text = await remoteArchive.getTextFileContents(filename)
        return getTextResponse(text)
    }
    return get404Response()
}

async function searchServer(request) {
    console.log("searching on server")
    let url = new URL(request.url)
    let params = new URLSearchParams(url.search)
    let term = params.get("term")
    console.log("term: " + term)
    let page = Number(params.get("page"))
    console.log("page: " + page)
    let pageSize = Number(params.get("pageSize"))
    console.log("page size: " + pageSize)
    let order = params.get("order")
    console.log("order: " + order)

    let backend = await Backend.factory()
    let searchResult = await backend.search(term, page, pageSize, order)
    if (searchResult != null) {
        return getJsonResponse(searchResult)
    } else {
        return get404Response()
    }
}

async function getProgressForBook(bookId) {
    // load progress from backend, if it exists
    let backend = await Backend.factory()
    let backendProgress = await backend.getProgress(bookId)
    // load progress from database
    let db = new Database()
    let databaseProgress = await db.loadProgress(bookId)
    if (backendProgress != null && databaseProgress != null) {
        console.log("> found progress in both")
        // use the latest progress
        if (backendProgress.updated > databaseProgress.updated) {
            console.log("> using backend progress")
            return backendProgress
        } else {
            console.log("> using database progress")
            return databaseProgress
        }
    } else if (backendProgress != null) {
        // save backend progress to local db and return it
        console.log("> only found backend progress")
        let res = await db.saveProgress(backendProgress.id, backendProgress.updated, backend.position)
        return backendProgress
    } else if (databaseProgress != null) {
        console.log("> only found database progress")
        let res = await backend.saveProgress(databaseProgress.id, databaseProgress.updated, databaseProgress.position)
        return databaseProgress
    } else {
        console.log("> no progress found")
        // we have no progress info, default position is 0
        return {
            id: bookId,
            updated: new Date(),
            position: 0
        }
    }
}

async function syncProgress(request) {
    let url = new URL(request.url)
    let pathParts = url.pathname.split("/")
    let bookId = pathParts[pathParts.length - 1]
    // check if we have a progress entry
    console.log(request.url)
    console.log(request.url.search)
    console.log(url.search)
    let params = new URLSearchParams(url.search)
    let progress = params.get("position")
    console.log("progress: " + progress)

    if (progress) {
        console.log("saving progress " + progress)
        // save progress
        let now = new Date()
        try {
            let db = new Database()
            let res = await db.saveProgress(bookId, now, progress)
            console.log("res")
        } catch (error) {
            console.log(error)
        }
        // todo: sync progress with backend if it exists
        let backend = await Backend.factory()
        let saveProgressResult = await backend.saveProgress(bookId, now, progress)
        console.log("saved progress to backend successful? " + saveProgressResult)
        return getJsonResponse(progress)
    } else {
        let progress = await getProgressForBook(bookId)
        return getJsonResponse(progress)
    }
}

async function loadBookMeta(request) {
    console.log("LOADING BOOK META")
    let url = new URL(request.url)
    let pathParts = url.pathname.split("/")
    let bookId = pathParts[pathParts.length - 1]

    let db = new Database()
    let bookObject = await db.loadBookMeta(bookId)
    console.log("book object for meta")
    console.log(bookObject)
    if (bookObject == null) {
        console.log("no meta in local db")
        let backend = await Backend.factory()
        let meta = await backend.getMeta(bookId)
        if (meta != null) {
            bookObject = meta
        }
    }
    if (bookObject != null) {
        let progress = await getProgressForBook(bookId)
        bookObject.position = progress.position
        bookObject.updated = progress.updated
        return getJsonResponse(bookObject)
    } else {
        return get404Response()
    }
}

async function loadBook(request) {
    let url = new URL(request.url)
    let pathParts = url.pathname.split("/")
    let bookId = pathParts[pathParts.length - 1]

    // check locally for book
    let db = new Database()
    let bookObject = await db.loadBook(bookId)
    if (bookObject) {
        console.log(bookObject)
        console.log(typeof bookObject.content)
        const hdrs = new Headers()
        //hdrs.append('Content-Type', bookObject.contentType)
        return new Response(bookObject.content, {
            status: 200,
            headers: hdrs
        })
    } else {
        // check for book on server
        let backend = await Backend.factory()
        return await backend.getContent(bookId)
    }
}