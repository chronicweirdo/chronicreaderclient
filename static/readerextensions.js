class RemoteArchive extends ArchiveWrapper {
    FILES_API_URL = "files"
    CONTENTS_BASE64_API_URL = "base64"
    CONTENTS_TEXT_API_URL = "text"
    constructor(url, baseApiUrl, id, headers = null) {
        super(url, null)
        this.baseApiUrl = baseApiUrl
        this.id = id
        this.headers = headers
    }

    getUrl() {
        return this.url
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
            console.log("retrieving archive files")
            let response = await this.fetchWithHeaders(this.baseApiUrl + "/" + this.id + "/" + this.FILES_API_URL)
            if (response && response.status == 200) {
                let result = await response.json()
                this.files = result
            } else {
                this.files = null
            }
        }
        return this.files
    }

    async getBase64FileContents(filename) {
        if (this.base64 == undefined || this.base64[filename] == undefined) {
            let response = await this.fetchWithHeaders(
                this.baseApiUrl + "/" + this.id + "/" + this.CONTENTS_BASE64_API_URL
                + "?" + new URLSearchParams({ filename: filename })
            )
            if (this.base64 == undefined) this.base64 = {}
            if (response && response.status == 200) {
                let result = await response.text()
                this.base64[filename] = result
            } else {
                this.base64[filename] = null
            }
        }
        return this.base64[filename]
    }

    async getTextFileContents(filename) {
        if (this.text == undefined || this.text[filename] == undefined) {
            let response = await this.fetchWithHeaders(
                this.baseApiUrl + "/" + this.id + "/" + this.CONTENTS_TEXT_API_URL
                + "?" + new URLSearchParams({ filename: filename })
            )
            if (this.text == undefined) this.text = {}
            if (response && response.status == 200) {
                let result = await response.text()
                this.text[filename] = result
            } else {
                this.text[filename] = null
            }
        }
        return this.text[filename]
    }
}