importScripts('/crypto-js.js')

const DATABASE_NAME = "chronicreaderclient"
const DATABASE_VERSION = "2"
const FILE_TABLE = 'files'

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
            console.log("upgrading database")
            let localDb = event.target.result
            var imagesStore = localDb.createObjectStore(FILE_TABLE, {keyPath: 'id'})
            resolve(localDb)
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
    } else if (url.pathname.startsWith("/book/")) {
        e.respondWith(loadBook(e.request))
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
    var wordArray = CryptoJS.lib.WordArray.create(bytes)
    let hash = CryptoJS.SHA256(wordArray).toString()
    return hash
}

async function handleUpload(request) {
    let form = await request.formData()
    let file = form.get("filename")
    console.log(file)
    let name = file.name
    let contentType = file.type
    let bytes = await file.arrayBuffer()
    console.log(bytes)
    // https://stackoverflow.com/questions/67549348/how-to-create-sha256-hash-from-byte-array-in-javascript
    // compute bytes hash for id
    let hash = getArrayBufferSHA256(bytes)
    console.log("hash: " + hash)
    let dbFile = {
        "id": hash,
        "name": name,
        "contentType": contentType,
        "content": bytes
    }

    await databaseSave(FILE_TABLE, dbFile)

    console.log("saved file")

    return Response.redirect("/", 302)
}

async function loadAllBooks() {
    let databaseBooks = await databaseLoadColumns(FILE_TABLE, "id", ["name"])
    console.log(databaseBooks)
    return getJsonResponse(Array.from(databaseBooks))
}

async function loadBook(request) {
    let url = new URL(request.url)
    let pathParts = url.pathname.split("/")
    let bookId = pathParts[pathParts.length - 1]

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
        return get404Response()
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

function databaseLoad(table, key) {
    return new Promise((resolve, reject) => {
        getDb().then(db => {
            let transaction = db.transaction([table])
            let objectStore = transaction.objectStore(table)
            let dbRequest = objectStore.get(key)
            dbRequest.onsuccess = function(event) {
                resolve(event.target.result)
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