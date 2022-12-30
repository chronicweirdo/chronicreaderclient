importScripts('/crypto-js.js')
importScripts('/jszip.js')
importScripts('/libunrar.js')
importScripts('/reader.js')

const DATABASE_NAME = "chronicreaderclient"
const DATABASE_VERSION = "3"
const FILE_TABLE = 'files'
const PROGRESS_TABLE = 'progress'
const CONNECTION_TABLE = 'connection'

function getDb() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)
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
                let imagesStore = localDb.createObjectStore(FILE_TABLE, {keyPath: 'id'})
                let progressStore = localDb.createObjectStore(PROGRESS_TABLE, {keyPath: 'id'})
                let connectionStore = localDb.createObjectStore(CONNECTION_TABLE, {keyPath: 'id'})
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

self.addEventListener('install', e => {
    console.log("installing service worker")
})

self.addEventListener('fetch', e => {
    var url = new URL(e.request.url)
    console.log("pathname: " + url.pathname)

    if (url.pathname.startsWith("/upload")) {
        e.respondWith(handleUpload(e.request))
    } else if (url.pathname.startsWith("/books")) {
        e.respondWith(loadAllBooks())
    } else if (url.pathname.startsWith("/bookmeta/")) {
        e.respondWith(loadBookMeta(e.request))
    } else if (url.pathname.startsWith("/book/")) {
        e.respondWith(loadBook(e.request))
    } else if (url.pathname.startsWith("/sync/")) {
        e.respondWith(syncProgress(e.request))
    } else if (url.pathname.startsWith("/search")) {
        e.respondWith(searchServer(e.request))
    } else if (url.pathname.startsWith("/login")) {
        e.respondWith(login(e.request))
    } else {
        e.respondWith(fetch(e.request))
    }
})

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
        let {server, token} = await Backend.loadToken()
        return new Backend(server, token)
    }
    constructor(server, token) {
        console.log("creating backend for " + server)
        this.server = server
        this.token = token
    }
    static async loadToken() {
        let connections = await databaseLoadAll(CONNECTION_TABLE)
        if (connections.length >= 1) {
            let connection = connections[0]
            return {
                server: connection.id,
                token: connection.token
            }
        }
        return {
            server: null,
            token: null
        }
    }
    static async saveToken(server, username, token) {
        console.log("deleting old token")
        let deletedResult = await databaseDeleteAll(CONNECTION_TABLE)
        console.log("saving new token")
        let savedResult = await databaseSave(CONNECTION_TABLE, {
            id: server,
            username: username,
            token: token
        })
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
            }
        } catch (error) {
            console.log(error)
        }
    }

    getAuthHeaders() {
        console.log(this.token)
        return { 'Authorization': 'Bearer ' + this.token}
    }

    async search(query, page = null, pageSize = null) {
        try {
            let url = this.server + "/search"
            if (query) {
                url += "/" + query
            }
            console.log("search " + url)
            let response = await fetch(url, {
                headers: this.getAuthHeaders()
            })
            return response
        } catch (error) {
            console.log(error)
            return get500Response()
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

    async getMeta(bookId) {
        try {
            let url = this.server + "/book/" + bookId
            let response = await fetch(url, {headers: this.getAuthHeaders()})
            return response
        } catch (error) {
            console.log(error)
            return get404Response()
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
                    date: new Date(progressJson.timestamp),
                    progress: progressJson.position
                }
            } else {
                return null
            }
        } catch (error) {
            console.log(error)
            return null
        }
    }

    async saveProgress(bookId, position) {
        try {
            let url = this.server + "/progress/" + bookId + "/" + position
            let response = await fetch(url, {method: 'PUT', headers: this.getAuthHeaders()})
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
}

async function login(request) {
    let form = await request.formData()
    let server = form.get("server")
    let username = form.get("username")
    let password = form.get("password")

    // run login with server
    /*try {
        let url = server + "/login"
        console.log("url: " + url)
        let body = JSON.stringify({username: username, password: password}) 
        console.log(body)
        let loginResponse = await fetch(server + '/login', { 
            method: 'POST', 
            body: body,
            headers: { 'Content-Type': 'application/json'}
        })
        console.log(loginResponse)
        if (loginResponse.status == 200) {
            let responseJson = await loginResponse.json()
            console.log(responseJson)
            let serverUsername = responseJson.data.username
            console.log("server username: " + serverUsername)
            let token = responseJson.data.token
            console.log("token: " + token)
            await databaseSave(CONNECTION_TABLE, {
                id: server,
                username: serverUsername,
                token: token
            })
        }
    } catch (error) {
        console.log(error)
    }*/
    let backend = new Backend(server, null)
    backend.login(server, username, password)

    return Response.redirect("/", 302)
}

async function handleUpload(request) {
    let form = await request.formData()
    let file = form.get("filename")
    console.log(file)
    let extension = getFileExtension(file.name)
    console.log("extension: " + extension)
    let title = file.name.substring(0, file.name.length - extension.length - 1)
    let contentType = file.type
    let bytes = await file.arrayBuffer()

    let cover = null
    try {
        let archive = ArchiveWrapper.factory(file, new Blob([bytes]), extension)
        let book = BookWrapper.factory(archive, extension)
        cover = await book.getCover()
        console.log(cover)
    } catch(error) {
        console.log(error)
    }


    // https://stackoverflow.com/questions/67549348/how-to-create-sha256-hash-from-byte-array-in-javascript
    // compute bytes hash for id
    let hash = getArrayBufferSHA256(bytes)
    console.log("hash: " + hash)
    let dbFile = {
        "id": hash,
        "title": title,
        "extension": extension,
        "contentType": contentType,
        "cover": cover,
        "content": bytes
    }

    let savedValue = await databaseSave(FILE_TABLE, dbFile)

    console.log("saved file")
    console.log(savedValue)

    return Response.redirect("/", 302)
}

async function loadAllBooks() {
    let databaseBooks = await databaseLoadColumns(FILE_TABLE, "id", ["title", "cover"])
    console.log(databaseBooks)
    return getJsonResponse(Array.from(databaseBooks))
}

/*function getServerSearchUrl(server, term) {
    if (term) {
        return server + "/search/" + term
    } else {
        return server + "/search"
    }
}*/

/*function getServerContentUrl(server, id) {
    return server + "/content/" + id
}*/

/*function getServerMetaUrl(server, id) {
    return server + "/book/" + id
}*/

/*async function getServerAndToken() {
    let connections = await databaseLoadAll(CONNECTION_TABLE)
    //console.log("connections:")
    //console.log(connections)
    if (connections.length >= 1) {
        let connection = connections[0]
        return {
            server: connection.id,
            token: connection.token
        }
    }
    return null
}*/

async function searchServer(request) {
    console.log("searching on server")
    let url = new URL(request.url)
    let params = new URLSearchParams(url.search)
    let query = params.get("q")
    
    /*try {
        let st = await getServerAndToken()
        //console.log("connection for search:")
        //console.log(st)
        let url = getServerSearchUrl(st.server, query)
        //console.log("url: " + url)
        let headers = { 'Authorization': 'Bearer ' + st.token}
        //console.log("headers")
        //console.log(headers)
        let response = await fetch(url, {
            /*credentials: 'include',
            headers : headers
        })
        //console.log(response)
        return response
    } catch (error) {
        //console.log(error)
        return get500Response()
    }*/

    let backend = await Backend.factory()
    return await backend.search(query)
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
            let res = await databaseSave(PROGRESS_TABLE, {
                "id": bookId,
                "date": now,
                "progress": progress
            })
            console.log("res")
        } catch (error) {
            console.log(error)
        }
        // todo: sync progress with backend if it exists
        let backend = await Backend.factory()
        let saveProgressResult = await backend.saveProgress(bookId, progress)
        console.log("saved progress to backend successful? " + saveProgressResult)
        return getJsonResponse(progress)
    } else {
        // todo: load progress from backend, if it exists
        let backend = await Backend.factory()
        let backendProgress = await backend.getProgress(bookId)
        console.log("backend progress:")
        console.log(backendProgress)
        // load progress from database
        let databaseProgress = await databaseLoad(PROGRESS_TABLE, bookId)
        console.log(databaseProgress)
        if (backendProgress != null && databaseProgress != null) {
            // use the latest progress
            if (backendProgress.date > databaseProgress.date) {
                return getJsonResponse(backendProgress.progress)
            } else {
                return getJsonResponse(databaseProgress.progress)
            }
        } else if (backendProgress != null) {
            // save backend progress to local db and return it
            let res = await databaseSave(PROGRESS_TABLE, backendProgress)
            return getJsonResponse(backendProgress.progress)
        } else if (databaseProgress != null) {
            // todo: compare two progress, return latest, update latest in local database
            return getJsonResponse(databaseProgress.progress)
        } else {
            // we have no progress info, default position is 0
            return getJsonResponse(0)
        }
    }
}

async function loadBookMeta(request) {
    console.log("LOADING BOOK META")
    let url = new URL(request.url)
    let pathParts = url.pathname.split("/")
    let bookId = pathParts[pathParts.length - 1]

    let bookObject = await databaseLoad(FILE_TABLE, bookId, ["title", "extension"])
    console.log("book object for meta")
    console.log(bookObject)
    if (bookObject) {
        console.log(bookObject)
        return getJsonResponse(bookObject)
    } else {
        console.log("no meta in local db")
        /*try {
            let st = await getServerAndToken()
            let response = await fetch(getServerMetaUrl(st.server, bookId), { headers: {"Authorization": "Bearer " + st.token}})
            //console.log("server meta:")
            //console.log(response)
            return response
        } catch (error) {
            console.log(error)
            return get404Response()
        }*/
        let backend = await Backend.factory()
        return await backend.getMeta(bookId)
    }
}

async function loadBook(request) {
    let url = new URL(request.url)
    let pathParts = url.pathname.split("/")
    let bookId = pathParts[pathParts.length - 1]

    // check locally for book
    let bookObject = await databaseLoad(FILE_TABLE, bookId)
    if (bookObject) {
        console.log(bookObject)
        console.log(typeof bookObject.content)
        const hdrs = new Headers()
        hdrs.append('Content-Type', bookObject.contentType)
        return new Response(bookObject.content, {
            status: 200,
            headers: hdrs
        })
    } else {
        console.log("no book in local db")
        // check for book on server
        /*try {
            let st = await getServerAndToken()
            let response = await fetch(getServerContentUrl(st.server, bookId), {headers: {"Authorization": "Bearer " + st.token}})
            return response
        } catch (error) {
            console.log(error)
            return get404Response()
        }*/
        let backend = await Backend.factory()
        return await backend.getContent(bookId)
    }
}

function databaseSave(table, value) {
    return new Promise((resolve, reject) => {
        getDb().then(db => {
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

function databaseLoad(table, key, columns = null) {
    return new Promise((resolve, reject) => {
        getDb().then(db => {
            let transaction = db.transaction([table])
            let objectStore = transaction.objectStore(table)
            let dbRequest = objectStore.get(key)
            dbRequest.onsuccess = function(event) {
                if (event.target.result) {
                    if (columns != null) {
                        let obj = {}
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

function databaseLoadAll(table) {
    return new Promise((resolve, reject) => {
        getDb().then(db => {
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

function databaseDeleteAll(table) {
    return new Promise((resolve, reject) => {
        getDb().then(db => {
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

function databaseLoadColumns(table, key, columns) {
    return new Promise((resolve, reject) => {
        getDb().then(db => {
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

function databaseLoadDistinct(table, column) {
    return new Promise((resolve, reject) => {
        getDb().then(db => {
            let transaction = db.transaction([table])
            let objectStore = transaction.objectStore(table)
            let cursorRequest = objectStore.openCursor()
            let distinctValues = new Set()
            cursorRequest.onsuccess = event => {
                let cursor = event.target.result
                if (cursor) {
                    distinctValues.add(cursor.value[column])
                    cursor.continue()
                } else {
                    resolve(distinctValues)
                }
            }
            cursorRequest.onerror = event => reject()
        })
    })
}