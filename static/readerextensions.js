ArchiveWrapper.originalFactory = ArchiveWrapper.factory
ArchiveWrapper.factory = function(type, content) {
    if (type == "external") {
        return new RemoteArchive(content)
    } else {
        return ArchiveWrapper.originalFactory(type, content)
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
            //console.log("retrieving archive files")
            let params = new URLSearchParams()
            params.append(this.FILES_ATTRIBUTE, null)
            let fetchFilesUrl = this.url + "?" + params
            let response = await this.fetchWithHeaders(fetchFilesUrl)
            if (response && response.status == 200) {
                let result = await response.json()
                //console.log("remote archive files: " + result)
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
                //console.log("successfully loaded remote contents")
                //console.log(result)

                this.contents[filename] = result
            } else {
                this.contents[filename] = null
            }
        }
        return this.contents[filename]
    }

    /*#toByteArray(dataArr) {
        var encoder = new TextEncoder("ascii");
        var base64Table = encoder.encode('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=');

        var padding = dataArr.byteLength % 3;
        var len = dataArr.byteLength - padding;
        padding = padding > 0 ? (3 - padding) : 0;
        var outputLen = ((len/3) * 4) + (padding > 0 ? 4 : 0);
        var output = new Uint8Array(outputLen);
        var outputCtr = 0;
        for(var i=0; i<len; i+=3){              
            var buffer = ((dataArr[i] & 0xFF) << 16) | ((dataArr[i+1] & 0xFF) << 8) | (dataArr[i+2] & 0xFF);
            output[outputCtr++] = base64Table[buffer >> 18];
            output[outputCtr++] = base64Table[(buffer >> 12) & 0x3F];
            output[outputCtr++] = base64Table[(buffer >> 6) & 0x3F];
            output[outputCtr++] = base64Table[buffer & 0x3F];
        }
        if (padding == 1) {
            var buffer = ((dataArr[len] & 0xFF) << 8) | (dataArr[len+1] & 0xFF);
            output[outputCtr++] = base64Table[buffer >> 10];
            output[outputCtr++] = base64Table[(buffer >> 4) & 0x3F];
            output[outputCtr++] = base64Table[(buffer << 2) & 0x3F];
            output[outputCtr++] = base64Table[64];
        } else if (padding == 2) {
            var buffer = dataArr[len] & 0xFF;
            output[outputCtr++] = base64Table[buffer >> 2];
            output[outputCtr++] = base64Table[(buffer << 4) & 0x3F];
            output[outputCtr++] = base64Table[64];
            output[outputCtr++] = base64Table[64];
        }

        return output
    }*/

    /*#toBase64(dataArr) {
        var decoder = new TextDecoder("ascii");
        
        let output = this.#toByteArray(dataArr)
        
        var ret = decoder.decode(output);
        output = null;
        dataArr = null;
        return ret;
    }*/

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
        //console.log("contents size " + contents.byteLength)
        let b64 = this._arrayBufferToBase64(contents)
        //console.log(b64)
        /*let bytesString = String.fromCharCode(...new Uint8Array(contents))
        //let bytesString = String.fromCharCode.apply(null, new Uint8Array(contents))
        console.log("bytes string:")
        console.log(bytesString.length)
        const base64String = window.btoa(bytesString);
        console.log(base64String)
        return base64String
        //return bytesString*/
        return b64
    }

    async getTextFileContents(filename) {
        let contents = await this.getFileContents(filename)
        let dec = new TextDecoder("utf-8")
        let text = dec.decode(new Uint8Array(contents))
        //console.log(text)
        return text
    }
}

ChronicReader.initDisplay = async (url, element, extension = null, settings = {}, bookSize = null) => {
    console.log("OVERWRITTEN")
    if (extension == null) {
        extension = getFileExtension(url)
    }
    let archiveType = ChronicReader.getArchiveType(extension)

    let display = Display.factory(element, settings, extension)
    
    let archiveWrapper = null
    let maxDownloadSize = 100 * 1000000
    if (document.downloadSizeSetting) {
        maxDownloadSize = document.downloadSizeSetting.get() * 1000000
    }
    if (bookSize != null & bookSize < maxDownloadSize) {
        let response = await fetch(url, { timeout: 60000 })
        let content = await response.blob()
        console.log("loading locally")
        archiveWrapper = ArchiveWrapper.factory(archiveType, content)
    } else {
        console.log("loading remotely")
        archiveWrapper = ArchiveWrapper.factory("external", url)
    }

    let bookWrapper = BookWrapper.factory(url, archiveWrapper, extension)
    if (bookWrapper) {
        display.setBook(bookWrapper)
    }

    return display
}