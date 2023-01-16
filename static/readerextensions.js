ArchiveWrapper.originalFactory = ArchiveWrapper.factory
ArchiveWrapper.EXTERNAL = "external"
ArchiveWrapper.factory = function(type, content) {
    if (type == "external") {
        return new RemoteArchive(content)
    } else {
        return ArchiveWrapper.originalFactory(type, content)
    }
}

EbookDisplay.loadPageCache = async (pageCacheKey) => {
    try {
        let response = await fetch("setting/" + pageCacheKey)
        if (response.status == 200) {
            let result = await response.text()
            return PageCache.deserialize(pageCacheKey, result)
        }
    } catch (error) {
        console.log(error)
    }
    return new PageCache(pageCacheKey)
}

EbookDisplay.savePageCache = async (pageCache) => {
    try {
        let key = pageCache.key
        console.log(key)
        let response = await fetch("setting/" + key, {
            method: "PUT",
            body: pageCache.serialize()
        })
    } catch (error) {
        console.log(error)
    }
}

class RemoteArchive extends ArchiveWrapper {
    FILES_ATTRIBUTE = "files"
    FILENAME_ATTRIBUTE = "filename"
    
    constructor(url, headers = null) {
        super(null)
        this.url = url
        this.headers = headers
    }

    async fetchWithHeaders(url) {
        if (this.headers) {
            return await fetch(url, { headers: this.headers})
        } else {
            return await fetch(url)
        }
    }

    async getFiles() {
        if (this.files == undefined) {
            let params = new URLSearchParams()
            params.append(this.FILES_ATTRIBUTE, null)
            let fetchFilesUrl = this.url + "?" + params
            let response = await this.fetchWithHeaders(fetchFilesUrl)
            if (response && response.status == 200) {
                let result = await response.json()
                this.files = result
            } else {
                this.files = null
            }
        }
        return this.files
    }

    async getFileContents(filename) {
        if (this.contents == undefined || this.contents[filename] == undefined) {
            let params = new URLSearchParams()
            params.append(this.FILENAME_ATTRIBUTE, filename)
            let response = await this.fetchWithHeaders(
                this.url + "?" + params
            )
            if (this.contents == undefined) this.contents = {}
            if (response && response.status == 200) {
                let result = await response.arrayBuffer()
                this.contents[filename] = result
            } else {
                this.contents[filename] = null
            }
        }
        return this.contents[filename]
    }

    _arrayBufferToBase64( buffer ) {
        var binary = '';
        var bytes = new Uint8Array( buffer );
        var len = bytes.byteLength;
        for (var i = 0; i < len; i++) {
            binary += String.fromCharCode( bytes[ i ] );
        }
        return window.btoa( binary );
    }


    async getBase64FileContents(filename) {
        let contents = await this.getFileContents(filename)
        let b64 = this._arrayBufferToBase64(contents)
        return b64
    }

    async getTextFileContents(filename) {
        let contents = await this.getFileContents(filename)
        let dec = new TextDecoder("utf-8")
        let text = dec.decode(new Uint8Array(contents))
        return text
    }
}

ChronicReader.initDisplay = async (id, url, element, extension = null, settings = {}, chunked) => {
    if (extension == null) {
        extension = getFileExtension(url)
    }
    let display = Display.factory(element, settings, extension)
    
    let archiveWrapper = null
    if (chunked) {
        archiveWrapper = ArchiveWrapper.factory(ArchiveWrapper.EXTERNAL, url)
    } else {
        let response = await fetch(url, { timeout: 60000 })
        let content = await response.blob()
        archiveWrapper = ArchiveWrapper.factory(extension, content)
    }

    let bookWrapper = BookWrapper.factory(id, archiveWrapper, extension)
    if (bookWrapper) {
        display.setBook(bookWrapper)
    }

    return display
}