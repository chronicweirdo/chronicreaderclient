//importScripts('/libs/bookNode.js')
//importScripts('/libs/reader.js')
//importScripts('/libs/database.js')

const DATABASE_NAME = "chronicreaderclient"
const DATABASE_VERSION = "2"
const FILE_TABLE = 'files'

class File {
    constructor(name, contentType, date, content) {
        this.name = name
        this.contentType = contentType
        this.date = date
        this.content = content
    }
}

//var db

function getDb() {
    return new Promise((resolve, reject) => {
        //if (! db) {
            const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)
            request.onerror = function(event) {
                console.log("failed to open database")
                reject()
            }
            request.onsuccess = function(event) {
                //db = event.target.result
                console.log("successfully opened database")
                resolve(event.target.result)
            }
            request.onupgradeneeded = function(event) {
                console.log("upgrading database")
                let localDb = event.target.result
                var imagesStore = localDb.createObjectStore(FILE_TABLE, {keyPath: 'name'})
                resolve(localDb)
            }
        //} else {
        //    resolve(db)
        //}
    })
}

//getDb()

self.addEventListener('install', e => {
    console.log("installing service worker")
})

self.addEventListener('fetch', e => {
    var url = new URL(e.request.url)
    console.log("pathname: " + url.pathname)
    //e.respondWith(fetch(e.request))

    if (url.pathname.startsWith("/upload")) {
        e.respondWith(handleUpload(e.request))
        //e.respondWith(Response.redirect("/", 302))
    } else if (url.pathname.startsWith("/books")) {
        e.respondWith(loadAllBooks())
    } else {
        e.respondWith(fetch(e.request))
    }

    /*if (url.pathname.startsWith("/book")) {
        let path = url.pathname.split("/")
        console.log(path)
        
        e.respondWith(loadBook(e.request))
    } else {*/
    /*if (url.pathname === '/markProgress') {
        e.respondWith(handleMarkProgress(e.request))
    } else if (url.pathname === '/loadProgress') {
        e.respondWith(handleLoadProgress(e.request))
    } else if (url.pathname === '/latestRead') {
        e.respondWith(handleLatestReadRequest(e.request))
    } else if (url.pathname === '/latestAdded') {
        e.respondWith(handleLatestAddedRequest(e.request))
    } else if (url.pathname === '/comic' || url.pathname === '/book') {
        e.respondWith(handleRootDataRequest(e.request))
    } else if (url.pathname === '/imageData' || url.pathname === '/bookResource') {
        e.respondWith(handleDataRequest(e.request))
    } else if (url.pathname === '/bookSection') {
        e.respondWith(handleBookSectionRequest(e.request))
    } else if (url.pathname === '/') {
        e.respondWith(handleRootRequest(e.request))
    } else if (url.pathname === '/search') {
        e.respondWith(handleSearchRequest(e.request))
    } else if ((url.pathname === '/login' && e.request.method == 'POST') || (url.pathname === '/logout')) {
        e.respondWith(handleLoginLogout(e.request))
    } else if (filesToCache.includes(url.pathname)) {
        e.respondWith(handleWebResourceRequest(e.request))
    } else {
        e.respondWith(fetch(e.request))
    }*/

    /*    e.respondWith(fetch(e.request))
    }*/
})

/*async function loadBook(request) {
    try {
        // check if book in cache
        let db = new Database(DATABASE_NAME, DATABASE_VERSION)
        let book = await db.load("book", "1")
        if (book == null) {
            // load book from server
            let bookResponse = await fetch(request)
            // store book to cache
            let headers = Object.fromEntries(bookResponse.headers.entries())
            let blob = await bookResponse.blob()
            book = await db.save("book", "1", {"headers": headers, "body": blob})
        }
        return new Response(book.body, {headers: new Headers(book.headers)})
    } catch (e) {
        console.log(e)
    }
}*/

/*function getComicContent(id, position) {

}*/



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

async function handleUpload(request) {
    let form = await request.formData()
    let file = form.get("filename")
    console.log(file)
    let name = file.name
    let contentType = file.type
    let bytes = await file.arrayBuffer()
    console.log(bytes)
    let dbFile = {
        "name": name,
        "contentType": contentType,
        "content": bytes
    }

    await databaseSave(FILE_TABLE, dbFile)

    console.log("saved file")

    return Response.redirect("/", 302)
}

async function loadAllBooks() {
    let databaseBooks = await databaseLoadDistinct(FILE_TABLE, "name")
    //let responseBooks = [] //databaseBooks.map((book) => book.name)
    //for (let i = 0; i < databaseBooks.length; i++) {
    //    responseBooks.push(databaseBooks[i].name)
    //}
    //console.log(responseBooks)
    console.log(databaseBooks)
    return getJsonResponse(Array.from(databaseBooks))
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