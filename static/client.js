var CLASS_SUCCESS = "success"
var CLASS_ERROR = "error"

function timeout(ms) {
    return new Promise((resolve, reject) => {
        window.setTimeout(function() {
            resolve()
        }, ms)
    })
}

class Component {
    static async create(tagName, ...args) {
        let element = document.createElement(tagName)
        let component = new this(element, ...args)
        await component.load()
        return element
    }
    static async createInParent(parent, tagName, ...args) {
        let element = document.createElement(tagName)
        parent.appendChild(element)
        let component = new this(element, ...args)
        await component.load()
        return component
    }
    constructor(element) {
        this.element = element
    }
    async load() {
        this.element.innerHTML = ""
    }

    async update(data) {
        console.log("update not implemented for " + this)
    }
}

class TabbedPage extends Component {
    CLASS_HIGHLIGHTED = "highlighted"
    CLASS_MENU = "menu"
    
    constructor(element) {
        super(element)
    }

    createButton(label, func) {
        let button = document.createElement("a")
        button.innerHTML = label
        button.onclick = func
        button.style.display = "inline-block"
        button.style.padding = ".4em"
        button.style.cursor = "pointer"
        return button
    }

    highlightButton(button) {
        button.classList.add(this.CLASS_HIGHLIGHTED)
    }

    resetButton(button) {
        button.classList.remove(this.CLASS_HIGHLIGHTED)
    }

    resetButtons() {
        this.resetButton(this.onDeviceButton)
        this.resetButton(this.latestReadButton)
        this.resetButton(this.latestAddedButton)
        this.resetButton(this.searchButton)
        this.resetButton(this.settingsButton)
    }

    async load() {
        await super.load()

        let buttons = document.createElement("div")
        buttons.classList.add(this.CLASS_MENU)
        //buttons.style.marginBottom = "2.5vw"
        this.element.appendChild(buttons)

        this.content = document.createElement("div")
        this.element.appendChild(this.content)

        let searchTab = new LibrarySearchTab(this.content)
        let globalSearchFunction = (term) => {
            this.resetButtons()
            this.highlightButton(this.searchButton)
            searchTab.load().then(() => searchTab.search(term))
        }
        let onDeviceTab = new OnDeviceTab(this.content, globalSearchFunction)
        let latestReadTab = new LatestReadTab(this.content, globalSearchFunction)
        let latestAddedTab = new LatestAddedTab(this.content, globalSearchFunction)
        let settingsTab = new SettingsTab(this.content)
        

        this.onDeviceButton = this.createButton("on device", () => {
            this.resetButtons()
            this.highlightButton(this.onDeviceButton)
            onDeviceTab.load()
        })
        buttons.appendChild(this.onDeviceButton)

        this.latestReadButton = this.createButton("latest read", () => {
            this.resetButtons()
            this.highlightButton(this.latestReadButton)
            latestReadTab.load()
        })
        buttons.appendChild(this.latestReadButton)

        this.latestAddedButton = this.createButton("latest added", () => {
            this.resetButtons()
            this.highlightButton(this.latestAddedButton)
            latestAddedTab.load()
        })
        buttons.appendChild(this.latestAddedButton)

        this.searchButton = this.createButton("search", () => {
            this.resetButtons()
            this.highlightButton(this.searchButton)
            searchTab.load()
        })
        buttons.appendChild(this.searchButton)

        this.settingsButton = this.createButton("settings", () => {
            this.resetButtons()
            this.highlightButton(this.settingsButton)
            settingsTab.load()
        })
        buttons.appendChild(this.settingsButton)

        this.highlightButton(this.onDeviceButton)
        onDeviceTab.load()
    }
}

class ServerConnectionDisplay extends Component {
    /*CLASS_FORM_ROW = "form_row"*/
    constructor(element) {
        super(element)
    }

    async load() {
        await super.load()

        /*this.element.classList.add(this.CLASS_FORM_ROW)*/

        let status = document.createElement("span")
        status.style.display = "inline-block"
        status.style.color = "white"

        fetch("/verify")
        .then(response => response.json())
        .then(result => {
            status.classList.remove(...status.classList)
            if (result && result != null && result.connected == true) {
                status.innerHTML = "connected to " + result.server
                //status.style.backgroundColor = "green"
                status.classList.add(CLASS_SUCCESS)
            } else {
                let message = "not connected"
                if (result && result != null && result.server != null && result.server.length > 0) {
                    message += " to " + result.server
                }
                if (result.code != undefined && result.code == 401) {
                    message += " - try to log in again"
                } else {
                    message += " - server is unavailable"
                }
                status.innerHTML = message
                //status.style.backgroundColor = "red"
                status.classList.add(CLASS_ERROR)
            }
        })

        this.element.appendChild(status)
    }
}

class FormComponent extends Component {
    CLASS_FORM_ROW = "form_row"
    constructor(element) {
        super(element)
    }

    title(text) {
        let h = document.createElement("h1")
        h.innerHTML = text
        h.classList.add(this.CLASS_FORM_ROW)
        return h
    }

    label(text, forName) {
        let l = document.createElement("label")
        l.innerHTML = text + ":"
        l.htmlFor = forName
        l.style.display = 'inline-block'
        l.style.width = "5em"
        return l
    }

    input(name) {
        let t = document.createElement("input")
        t.type = "text"
        t.name = name
        t.style.maxWidth = "200px"
        return t
    }

    file(name) {
        let t = document.createElement("input")
        t.type = "file"
        t.name = name
        t.accept = ".cbz,.cbr,.epub"
        return t
    }

    password(name) {
        let t = document.createElement("input")
        t.type = "password"
        t.name = name
        t.style.maxWidth = "200px"
        return t
    }

    p(left, right = null) {
        let p = document.createElement("p")

        if (left != null) {
            p.appendChild(left)
        }
        
        if (right != null) {
            right.style.justifySelf = "right"
            p.appendChild(right)
        } else if (left != null) {
            left.style.gridColumn = "1/3"
            left.style.justifySelf = "auto"
        }
        
        p.classList.add(this.CLASS_FORM_ROW)
        if (left != null) {
            p.style.display = "grid"
            p.style.gridTemplateColumns = "auto auto"
        }
        return p
    }

    async load() {
        await super.load()
    }
}

class UploadForm extends FormComponent {
    constructor(element) {
        super(element)
    }

    async load() {
        await super.load()

        this.element.appendChild(this.title("File Upload"))
        /*let fileLabel = this.label("filename", "filename")
        this.element.appendChild(this.p(fileLabel))*/

        let fileInput = this.file("filename")
        this.element.appendChild(this.p(fileInput))

        let uploadResult = document.createElement("span")
        /*uploadResult.style.color = "white"
        uploadResult.style.marginLeft = "1em"*/
        let button = document.createElement("a")
        button.innerHTML = "upload"
        button.onclick = () => {
            let file = fileInput.files[0]

            fetch("/upload", { 
                method: 'POST', 
                body: file,
                headers: {
                    'Content-Type': 'application/octet-stream', 
                    'filename': file.name
                }
            })
            .then(response => {
                if (response.status == 200) {
                    return response.json()
                } else {
                    return null
                }
            })
            .then(result => {
                if (result == true) {
                    uploadResult.innerHTML = "file upload was successful"
                    uploadResult.style.backgroundColor = "green"
                } else {
                    uploadResult.innerHTML = "file upload failed"
                    uploadResult.style.backgroundColor = "red"
                }
                timeout(5000).then(() => {
                    uploadResult.innerHTML = ""
                    uploadResult.style.backgroundColor = "transparent"
                })
            })
        }
        this.element.appendChild(this.p(button, uploadResult))
    }
}

class LoginForm extends FormComponent {
    constructor(element) {
        super(element)
    }

    async load() {
        await super.load()

        this.element.appendChild(this.title("Server Connection"))

        let serverConnectionElement = this.p(null)
        let serverConnectionDisplay = new ServerConnectionDisplay(serverConnectionElement)
        serverConnectionDisplay.load()
        this.element.appendChild(serverConnectionElement)
        
        let serverLabel = this.label("server", "server")
        let serverInput = this.input("server")
        this.element.appendChild(this.p(serverLabel, serverInput))

        let usernameLabel = this.label("username", "username")
        let usernameInput = this.input("username")
        this.element.appendChild(this.p(usernameLabel, usernameInput))

        let passwordLabel = this.label("password", "password")
        let passwordInput = this.password("password")
        this.element.appendChild(this.p(passwordLabel, passwordInput))

        let loginResult = document.createElement("span")
        //loginResult.style.marginLeft = "1em"
        //loginResult.style.color = "white"

        let button = document.createElement("a")
        button.innerHTML = "login"
        button.onclick = () => {
            let body = JSON.stringify({
                server: serverInput.value,
                username: usernameInput.value, 
                password: passwordInput.value
            })
            fetch("/login", { 
                method: 'POST', 
                body: body,
                headers: { 'Content-Type': 'application/json'}
            })
            .then(response => {
                console.log(response)
                return response.json()
            })
            .then(result => {
                console.log(result)
                loginResult.classList.remove(...loginResult.classList)
                if (result == true) {
                    loginResult.innerHTML = "login successful"
                    loginResult.classList.add(CLASS_SUCCESS)
                } else {
                    loginResult.innerHTML = "login failed"
                    loginResult.classList.add(CLASS_ERROR)
                }
                serverConnectionDisplay.load()
                timeout(5000).then(() => {
                    loginResult.innerHTML = ""
                    //loginResult.style.backgroundColor = "transparent"
                })
            })
        }
        this.element.appendChild(this.p(button, loginResult))
    }
}

class SettingsTab extends Component {
    constructor(element) {
        super(element)
    }

    async load() {
        await super.load()

        await LoginForm.createInParent(this.element, "div")
        /*let loginFormDiv = document.createElement("div")
        this.element.appendChild(loginFormDiv)
        let loginForm = new LoginForm(loginFormDiv)
        await loginForm.load()*/

        await UploadForm.createInParent(this.element, "div")
        /*let uploadFormDiv = document.createElement("div")
        this.element.appendChild(uploadFormDiv)
        let uploadForm = new UploadForm(uploadFormDiv)
        await uploadForm.load()*/

        let settingsTitle = document.createElement("h1")
        settingsTitle.innerHTML = "Settings"
        this.element.appendChild(settingsTitle)

        for (let setting of document.settings) {
            let p = document.createElement("p")
            this.element.appendChild(p)
            setting.element = p
            setting.load()
        }
        //let dtbc = await ColorSetting.createInParent(this.element, "p", "light theme background color", "#ff0000")
    }
}

class OnDeviceTab extends Component {
    constructor(element, searchFunction = null) {
        super(element)
        this.searchFunction = searchFunction
    }

    async load() {
        await super.load()

        await fetch("/books")
            .then(response => response.json())
            .then((books) => {
                let list = new BookList(this.element, false, this.searchFunction)
                list.load().then(() => list.update(books))
                /*for (let book of books) {
                    list.addBook(book)
                }*/
            })
    }
}

class LatestReadTab extends Component {
    constructor(element, searchFunction = null) {
        super(element)
        this.searchFunction = searchFunction
    }

    async load() {
        await super.load()
        let search = new Search(this.element, "", 5, Search.ORDER_LATEST_READ, true, this.searchFunction)
        await search.load()
    }
}

class LatestAddedTab extends Component {
    constructor(element, searchFunction = null) {
        super(element)
        this.searchFunction = searchFunction
    }

    async load() {
        await super.load()
        let search = new Search(this.element, "", 5, Search.ORDER_LATEST_ADDED, true, this.searchFunction)
        await search.load()
    }
}

class LibrarySearchTab extends Component {
    CLASS_SEARCH_SECTION = "search_section"
    constructor(element) {
        super(element)
    }

    async search(term = null) {
        console.log(this)
        if (term == null) {
            term = this.searchField.value
        } else {
            this.searchField.value = term
        }
        console.log("searching for: " + term)

        let search = new Search(this.searchList, term, 5, Search.ORDER_TITLE, true, (term) => this.search(term))
        await search.load()
    }

    async load() {
        await super.load()

        let searchSection = document.createElement("p")

        this.searchField = document.createElement("input")
        this.searchField.type = "text"
        searchSection.appendChild(this.searchField)
        //this.element.appendChild(this.searchField)

        this.searchButton = document.createElement("a")
        this.searchButton.innerHTML = "search"
        this.searchButton.onclick = () => this.search()
        searchSection.appendChild(this.searchButton)
        //this.element.appendChild(this.searchButton)
        this.element.appendChild(searchSection)

        this.searchList = document.createElement("div")
        this.element.appendChild(this.searchList)

        await this.search()
    }
}

class BookItem extends Component {
    CLASS_PROGRESS_ENCLOSURE = "progress_enclosure"
    CLASS_PROGRESS_BAR = "progress_bar"
    CLASS_COVER_ENCLOSURE = "cover_enclosure"

    constructor(element, book, withCollection, searchFunction = null) {
        super(element)
        if (element.tagName != "LI") throw "book item must be applied to li"
        this.book = book
        this.withCollection = withCollection
        this.searchFunction = searchFunction
    }

    getProgressItem(book) {
        if (book.position) {
            let progressEnclosure = document.createElement("span")
            progressEnclosure.style.position = "absolute"
            progressEnclosure.style.width = "80%"
            progressEnclosure.style.height = "5%"
            progressEnclosure.style.bottom = "5%"
            progressEnclosure.style.left = "10%"
            progressEnclosure.style.display = "inline-block"
            //progressEnclosure.style.backgroundColor = "white"
            progressEnclosure.classList.add(this.CLASS_PROGRESS_ENCLOSURE)
            //progressEnclosure.style.border = "1px solid black"

            let progress = document.createElement("span")
            progress.style.position = "absolute"
            progress.style.display = "inline-block"
            /*progress.style.margin = "10%"*/
            progress.style.height = "80%"
            progress.style.width = (99 * (book.position / book.size)) + "%"
            progress.style.top = "10%"
            progress.style.left = "1%"
            progress.classList.add(this.CLASS_PROGRESS_BAR)
            //progress.style.backgroundColor = "black"

            progressEnclosure.appendChild(progress)
            return progressEnclosure
        } else {
            return null
        }
    }
    
    
    async getCoverItem(book) {
        let imageEnclosure = document.createElement("span")
        imageEnclosure.classList.add(this.CLASS_COVER_ENCLOSURE)
        /*imageEnclosure.style.overflow = 'hidden'
        imageEnclosure.style.position = "relative"
        imageEnclosure.style.display = 'block'
        imageEnclosure.style.height = (8/5*30) + 'vw'*/

        let image = document.createElement("img")
        if (book.cover == null) {
            image.src = await this.createBookCover(book.id, book.title, 500, 800)
        } else {
            image.src = book.cover
        }
        image.onload = () => {
            // center the image
            image.style.top = (- (image.height - image.parentElement.offsetHeight) / 2) + "px"
            image.style.left = (- (image.width - image.parentElement.offsetWidth) / 2) + "px"
        }
        image.style.height = '100%'
        image.style.position = "relative"
        imageEnclosure.appendChild(image)

        let progressItem = this.getProgressItem(book)
        if (progressItem != null) {
            imageEnclosure.appendChild(progressItem)
        }

        return imageEnclosure
    }

    getIdSeed(id) {
        return parseInt(id, 16) / BookList.SEED_MAX
    }

    numToRgb(val) {
        let maxVal = 1
        let i = (val * 255 / maxVal)
        let r = Math.round(Math.sin(0.024 * i + 0) * 127 + 128)
        let g = Math.round(Math.sin(0.024 * i + 2) * 127 + 128)
        let b = Math.round(Math.sin(0.024 * i + 4) * 127 + 128)
        return [r, g, b]
    }

    computeLuminance(rgb) {
        let R = rgb[0]
        let G = rgb[1]
        let B = rgb[2]
        return Math.sqrt(0.299*R*R + 0.587*G*G + 0.114*B*B)
    }

    async createBookCover(id, title, width, height, element) {
        let margin = width / 10
        let words = title.split(/\s/g)
        let rows = []
        let row = ""
        let words_on_row = 3
        let longestRow = 0
        for (let i = 0; i < words.length; i++) {
            if (i % words_on_row == 0) {
                if (row.length > 0) {
                    rows.push(row)
                    if (row.length > rows[longestRow].length) longestRow = rows.length - 1
                }
                row = words[i]
            } else {
                row += " " + words[i]
            }
        }
        if (row.length > 0) {
            rows.push(row)
            if (row.length > rows[longestRow].length) longestRow = rows.length - 1
        }

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const context = canvas.getContext('2d')
        let colorSeed = this.getIdSeed(id)
        let coverRgb = this.numToRgb(colorSeed)
        let coverColor = `rgb(${coverRgb[0]},${coverRgb[1]},${coverRgb[2]})`
        let luminance = this.computeLuminance(coverRgb)
        let threshold = 140
        let textColor = "#000000"
        if (luminance < threshold) {
            textColor = "#ffffff"
        }
        context.fillStyle = coverColor
        context.fillRect(0, 0, width, height)
        context.fillStyle = textColor
        context.textAlign = "center"

        // find correct font size
        //let f = new FontFace("Merriweather", 'url("/Merriweather/Merriweather-Regular.ttf")')
        //await f.load()

        let fontSize = width/rows[longestRow].length * 3
        context.font = fontSize + 'px "Merriweather"'
        while (context.measureText(rows[longestRow]).width > width - margin) {
            fontSize -= 1
            // font-family: 'Merriweather', serif;
            context.font = fontSize + 'px "Merriweather"'
        }

        let rowHeight = 0
        //let totalHeight = 0
        for (let i = 0; i < rows.length; i++) {
            let tm = context.measureText(rows[i])
            //console.log(tm)
            let height = tm.actualBoundingBoxAscent + tm.actualBoundingBoxDescent
            //totalHeight += height
            if (height > rowHeight) rowHeight = height
        }
        //console.log(rowHeight)
        let rowSpacing = 10
        rowHeight = rowHeight + rowSpacing
        let totalHeight = rowHeight * rows.length

        for (let i = 0; i < rows.length; i++) {
            let h = (height/2) - (totalHeight/2) + (i+1) * rowHeight// + rowHeight / 2
            context.fillText(rows[i], width/2, h)
        }
        
        let base64 = canvas.toDataURL() 
        
        if (element) {
            let img = document.createElement('img')
            img.src = base64
            element.appendChild(img)
        }

        return base64
    }

    static getCollectionItems(collection, searchFunction) {
        if (collection == undefined || collection == null || collection.length == 0) return []
        if (searchFunction != undefined && searchFunction != null) {
            let collectionParts = collection.split("/").filter(e => e.length > 0)
            let cumulative = ""
            let items = []
            for (let part of collectionParts) {
                let partName = "/" + part
                let partSearch = cumulative + partName

                let collectionItem = document.createElement("a")
                collectionItem.innerHTML = partName
                collectionItem.onclick = () => searchFunction(partSearch)
                items.push(collectionItem)

                cumulative = partSearch
            }

            return items
        } else {
            let collectionItem = document.createElement("span")
            collectionItem.innerHTML = collection
            return [collectionItem]
        }
    }

    getBookLink() {
        return "read.html?book=" + this.book.id
    }

    async load() {
        await super.load()

        this.element.style.width = '100%'
        this.element.style.overflow = 'hidden'

        let itemLink = document.createElement("a")
        itemLink.style.overflow = 'hidden'
        itemLink.style.position = 'relative'
        itemLink.href = this.getBookLink()
        
        itemLink.appendChild(await this.getCoverItem(this.book))
        this.element.appendChild(itemLink)

        if (this.withCollection == true) {
            let title = document.createElement("span")
            let items = BookItem.getCollectionItems(this.book.collection, this.searchFunction)
            for (let i of items) {
                title.appendChild(i)
            }
            if (items.length > 0) {
                let slash = document.createElement("span")
                slash.innerHTML = "/"
                title.appendChild(slash)
            }
            let actualTitle = document.createElement("a")
            actualTitle.innerHTML = this.book.title
            actualTitle.href = this.getBookLink()
            title.appendChild(actualTitle)
            this.element.appendChild(title)
        } else {
            let title = document.createElement("a")
            title.innerHTML = this.book.title
            title.href = this.getBookLink()
            this.element.appendChild(title)
        }
    }
}

class BookList extends Component {
    static SEED_MAX = parseInt("ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff", 16)
    /*CLASS_BOOK_LIST = "book_list"
    CLASS_BOOK_LIST_TITLE = "book_list_title"*/

    constructor(element, withCollections = false, searchFunction = null) {
        super(element)
        this.withCollections = withCollections
        this.searchFunction = searchFunction
    }

    async load() {
        await super.load()
    }

    createTitle(collection) {
        let title = document.createElement("h1")
        //title.classList.add(this.CLASS_BOOK_LIST_TITLE)
        if (this.searchFunction != undefined && this.searchFunction != null) {
            let items = BookItem.getCollectionItems(collection, this.searchFunction)
            for (let i of items) {
                title.appendChild(i)
            }
        } else {
            title.innerHTML = collection
        }
        return title
    }

    createListElement() {
        let list = document.createElement('ul')
        //list.classList.add(this.CLASS_BOOK_LIST)
        //list.style.padding = '0'
        //list.style.listStyleType = 'none'
        //list.style.display = 'grid'
        //list.style.gridTemplateColumns = '30vw 30vw 30vw'
        //list.style.columnGap = '2.5vw'
        //list.style.rowGap = '2.5vw'
        //list.style.marginLeft = "2.5vw"
        return list
    }

    getListElement() {
        if (this.listElement == undefined) {
            this.listElement = this.createListElement()
            this.element.appendChild(this.listElement)
        }
        return this.listElement
    }

    getCollectionElement(collection) {
        if (this.collections == undefined) {
            this.collections = new Map()
        }
        if (this.collections.has(collection)) {
            return this.collections.get(collection).list
        } else {
            let collectionTitle = null
            if (collection != null && collection.length > 0) {
                let collectionTitle = this.createTitle(collection)
                this.element.appendChild(collectionTitle)
            }
            let collectionList = this.createListElement()
            this.element.appendChild(collectionList)
            this.collections.set(collection, {
                title: collectionTitle,
                list: collectionList
            })
            return collectionList
        }
    }

    async addBook(book) {
        let parent = null
        if (this.withCollections) {
            parent = this.getCollectionElement(book.collection)
        } else {
            parent = this.getListElement()
        }

        let bookListItem = document.createElement("li")
        parent.appendChild(bookListItem)
        let bookItem = new BookItem(bookListItem, book, ! this.withCollections, this.searchFunction) //await this.getBookItem(book)
        bookItem.load()
    }

    async update(books) {
        for (let book of books) {
            this.addBook(book)
        }
    }

    
}





class Search extends Component {
    static ORDER_LATEST_READ = "read"
    static ORDER_LATEST_ADDED = "added"
    static ORDER_TITLE = ""
    CLASS_SEARCH_SECTION = "search_section"
    constructor(element, term, pageSize, order, multipage, collectionLinkFunction = null) {
        super(element)
        this.term = term
        this.pageSize = pageSize
        this.order = order
        this.multipage = multipage
        this.collectionLinkFunction = collectionLinkFunction
    }

    getUrl() {
        return "search?" + new URLSearchParams({
            term: this.term,
            page: this.page,
            pageSize: this.pageSize,
            order: this.order
        }) 
    }

    createNextButton() {
        let p = document.createElement("p")
        let button = document.createElement("a")
        button.innerHTML = "next"
        //button.classList.add(this.CLASS_NEXT_BUTTON)
        /*button.style.margin = "2.5vw"
        button.style.display = "block"*/
        p.style.display = "none"
        button.onclick = () => {
            this.nextSearch()
        }
        p.appendChild(button)
        return p
    }

    createLoading() {
        let p = document.createElement("p")
        p.innerHTML = "Loading..."
        p.style.margin = "2.5vw"
        p.style.display = "none"
        return p
    }

    showLoading() {
        this.hideNextButton()
        this.loading.style.display = "block"
    }

    hideLoading() {
        this.loading.style.display = "none"
    }

    showNextButton() {
        this.nextButton.style.display = "block"
    }

    hideNextButton() {
        this.nextButton.style.display = "none"
    }

    showErrorMessage() {
        this.hideLoading()
        this.hideNextButton()
        this.errorMessage.style.display = "block"
    }

    addBooksToResult(books) {
        /*if (this.nextPage) {
            this.nextPage.remove()
            this.nextPage = null
        }*/
        this.hideLoading()
        this.bookList.update(books)
        if (this.multipage) {
            if (books.length == this.pageSize) {
                this.showNextButton()
                /*this.nextPage = this.createNextButton()
                this.element.appendChild(this.nextPage)*/
            }
        }
    }

    createSearchError() {
        let errorMessage = document.createElement("p")
        errorMessage.innerHTML = "there was an issue running the search"
        errorMessage.style.backgroundColor = "red"
        errorMessage.style.color = "white"
        errorMessage.style.margin = "2.5vw"
        errorMessage.style.display = "none"
        return errorMessage
    }

    async runSearch() {
        this.showLoading()
        await fetch(this.getUrl())
            .then(response => {
                if (response.status == 200) {
                    return response.json()
                } else {
                    return null
                }
            })
            .then(searchResult => {
                if (searchResult != null) {
                    this.addBooksToResult(searchResult)
                } else {
                    this.showErrorMessage()
                }
            })
    }

    async load() {
        await super.load()
        let withCollectionSections = (this.order == Search.ORDER_TITLE)
        let bookListDiv = document.createElement("div")
        this.element.appendChild(bookListDiv)
        this.bookList = new BookList(bookListDiv, withCollectionSections, this.collectionLinkFunction)
        await this.bookList.load()

        this.nextButton = this.createNextButton()
        this.element.appendChild(this.nextButton)
        this.loading = this.createLoading()
        this.element.appendChild(this.loading)
        this.errorMessage = this.createSearchError()
        this.element.appendChild(this.errorMessage)

        this.page = 0
        await this.runSearch()
    }

    async nextSearch() {
        this.page = this.page + 1
        await this.runSearch()
    }
}

class Setting extends Component {
    CLASS_SETTING = "setting"
    constructor(element, name, defaultValue = null) {
        super(element)
        this.name = name
        this.defaultValue = defaultValue
        this.apply()
    }

    async load() {
        await super.load()

        this.element.classList.add(this.CLASS_SETTING)
        this.element.style.display = "grid"
        this.element.style.gridTemplateColumns = "auto auto"
    }

    getKey() {
        return this.name.replaceAll(/\s/g, "_")
    }

    persist(value) {
        window.localStorage.setItem(this.getKey(), JSON.stringify(value))
    }

    get() {
        let savedValue = window.localStorage.getItem(this.getKey())
        if (savedValue != undefined && savedValue != null) {
            return JSON.parse(savedValue)
        } else {
            return this.defaultValue
        }
    }

    apply() {
        if (this.chainedSettings != null) {
            for (let s of this.chainedSettings) {
                s.apply()
            }
        }
    }
}

class ColorSetting extends Setting {
    constructor(element, name, defaultValue = "#ffffff") {
        super(element, name, defaultValue)
    }

    async load() {
        await super.load()

        let label = document.createElement("label")
        label.innerHTML = this.name
        label.forName = this.getKey()
        this.element.appendChild(label)

        let input = document.createElement("input")
        input.style.justifySelf = "right"
        input.type = "color"
        input.name = this.getKey()
        input.value = this.get()
        this.element.appendChild(input)
        
        input.onchange = () => {
            this.persist(input.value)
            this.apply()
        }
    }

    apply() {
        document.documentElement.style.setProperty("--" + this.getKey(), this.get())
        super.apply()
    }
}

class OptionsSliderSetting extends Setting {
    constructor(element, name, values, defaultValue) {
        super(element, name, defaultValue)
        this.values = values
    }

    async load() {
        await super.load()

        let label = document.createElement("label")
        label.innerHTML = this.name
        label.forName = this.getKey()
        this.element.appendChild(label)

        let valueLabel = document.createElement("output")
        valueLabel.style.justifySelf = "right"
        valueLabel.innerHTML = this.get()
        this.element.appendChild(valueLabel)

        let input = document.createElement("input")
        input.style.gridColumn = "1/3"
        input.style.justifySelf = "auto"
        input.type = "range"
        input.name = this.getKey()
        input.min = 0
        input.max = this.values.length - 1
        input.step = 1
        console.log(this.values.indexOf(this.get()))
        input.value = this.values.indexOf(this.get())
        this.element.appendChild(input)
        
        input.onchange = () => {
            let value = this.values[input.value]
            this.persist(value)
            valueLabel.innerHTML = value
            this.apply()
        }
    }
}

class ThemeSliderSetting extends OptionsSliderSetting {
    constructor(element, dayStartSetting, dayEndSetting) {
        super(element, "theme", ["dark", "OS theme", "time based", "light"], "light")
        this.dayStartSetting = dayStartSetting
        this.dayEndSetting = dayEndSetting
        this.apply()
    }
    
    timeStringToDate(value) {
        return new Date((new Date()).toDateString() + " " + value)
    }

    apply() {
        if (this.dayStartSetting != undefined && this.dayEndSetting != undefined) {
            let value = this.get()
            if (value == "light") {
                document.body.classList.remove("dark")
            } else if (value == "dark") {
                document.body.classList.add("dark")
            } else if (value == "OS theme") {
                if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
                    document.body.classList.add("dark")
                } else {
                    document.body.classList.remove("dark")
                }
            } else if (value == "time based") {
                let dayStart = this.timeStringToDate(this.dayStartSetting.get())
                let dayEnd = this.timeStringToDate(this.dayEndSetting.get())
                let now = new Date()
                if (now < dayStart || dayEnd < now) {
                    document.body.classList.add("dark")
                } else {
                    document.body.classList.remove("dark")
                }
            }
            super.apply()
        }
    }
}

class TimeSetting extends Setting {
    constructor(element, name, defaultValue) {
        super(element, name, defaultValue)
    }

    async load() {
        await super.load()

        let label = document.createElement("label")
        label.innerHTML = this.name
        label.forName = this.getKey()
        this.element.appendChild(label)

        let input = document.createElement("input")
        input.style.justifySelf = "right"
        input.type = "time"
        input.name = this.getKey()
        input.value = this.get()
        this.element.appendChild(input)
        
        input.onchange = () => {
            this.persist(input.value)
            this.apply()
        }
    }

    apply() {
        super.apply()
    }
}