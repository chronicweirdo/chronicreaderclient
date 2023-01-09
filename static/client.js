var CLASS_SUCCESS = "success"
var CLASS_ERROR = "error"
var CLASS_HIGHLIGHTED = "highlighted"

function timeout(ms) {
    return new Promise((resolve, reject) => {
        window.setTimeout(function() {
            resolve()
        }, ms)
    })
}

function setMeta(metaName, value) {
    document.querySelector('meta[name="' + metaName + '"]').setAttribute("content", value);
}

function setStatusBarColor(color) {
    setMeta('theme-color', color)
    document.documentElement.style.setProperty('--status-bar-color', color)
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
    CLASS_MENU = "menu"
    STORAGE_KEY = "tabbed_page_latest_tab"
    
    constructor(element) {
        super(element)
    }

    createButton(label) {
        let button = document.createElement("a")
        button.innerHTML = label
        button.onclick = (event) => this.displayTab(event.target)
        button.style.display = "inline-block"
        button.style.padding = ".4em"
        button.style.cursor = "pointer"
        return button
    }

    saveTabIndex(i) {
        window.localStorage.setItem(this.STORAGE_KEY, JSON.stringify(i))
    }

    loadTabIndex() {
        let savedValue = window.localStorage.getItem(this.STORAGE_KEY)
        if (savedValue != undefined && savedValue != null) {
            return JSON.parse(savedValue)
        } else {
            return 0
        }
    }

    async displayTab(button) {
        for (let i in this.tabs) {
            let t = this.tabs[i]
            if (t.button == button) {
                this.saveTabIndex(i)
                t.button.classList.add(CLASS_HIGHLIGHTED)
                t.tab.load().then(() => {
                    // todo: consider removing this and making body use the background color for the library page
                    if (t.tab.element.offsetHeight + t.tab.element.offsetTop < window.innerHeight) {
                        console.log("need to fix height")
                        t.tab.element.style.height = (window.innerHeight - t.tab.element.offsetTop) + "px"
                    } else {
                        t.tab.element.style.removeProperty("height")
                    }
                })
            } else {
                t.button.classList.remove(CLASS_HIGHLIGHTED)
            }
        }
    }

    async load() {
        await super.load()

        let buttons = document.createElement("div")
        buttons.classList.add(this.CLASS_MENU)
        this.element.appendChild(buttons)

        this.content = document.createElement("div")
        this.element.appendChild(this.content)

        let searchTab = new LibrarySearchTab(this.content)
        let searchButton = this.createButton("search")
        let globalSearchFunction = (term) => {
            this.displayTab(searchButton).then(() => searchTab.search(term))
        }

        this.tabs = [
            {
                tab: new OnDeviceTab(this.content, globalSearchFunction),
                button: this.createButton("on device")
            },
            {
                tab: new LatestReadTab(this.content, globalSearchFunction),
                button: this.createButton("latest read")
            },
            {
                tab: new LatestAddedTab(this.content, globalSearchFunction),
                button: this.createButton("latest added")
            },
            {
                tab: searchTab,
                button: searchButton
            },
            {
                tab: new SettingsTab(this.content),
                button: this.createButton("settings")
            }
        ]
        
        for (let t of this.tabs) {
            buttons.appendChild(t.button)   
        }

        let tabIndex = this.loadTabIndex()
        this.displayTab(this.tabs[tabIndex].button)
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

        let fileInput = this.file("filename")
        this.element.appendChild(this.p(fileInput))

        let uploadResult = document.createElement("span")
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

        let serverConnection = this.p(null)
        serverConnection.style.display = "inline-block"
        serverConnection.style.overflowWrap = "anywhere"
        this.element.appendChild(serverConnection)
        
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

        let verifyConnection = () => {
            fetch("/verify")
            .then(response => response.json())
            .then(result => {
                serverConnection.classList.remove(...serverConnection.classList)
                if (result && result != null && result.connected == true) {
                    serverConnection.innerHTML = "connected"
                    serverConnection.classList.add(CLASS_SUCCESS)
                } else {
                    let message = "not connected"
                    if (result.code != undefined && result.code == 401) {
                        message += " - try to log in again"
                    } else {
                        message += " - server is unavailable"
                    }
                    serverConnection.innerHTML = message
                    serverConnection.classList.add(CLASS_ERROR)
                }
                if (result && result != null && result.server) {
                    serverInput.value = result.server
                }
                if (result && result != null && result.username) {
                    usernameInput.value = result.username
                }
            })
        }

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
                verifyConnection()
                timeout(5000).then(() => {
                    loginResult.innerHTML = ""
                })
            })
        }
        this.element.appendChild(this.p(button, loginResult))

        verifyConnection()
    }
}

class SettingsTab extends Component {
    constructor(element) {
        super(element)
    }

    async load() {
        await super.load()

        await LoginForm.createInParent(this.element, "div")

        await UploadForm.createInParent(this.element, "div")

        let settingsTitle = document.createElement("h1")
        settingsTitle.innerHTML = "Settings"
        this.element.appendChild(settingsTitle)

        for (let setting of document.settings) {
            let p = document.createElement("p")
            this.element.appendChild(p)
            setting.element = p
            await setting.load()
        }

        let clearStorageParagraph = document.createElement("p")
        let clearStorage = new ClearStorageControl(clearStorageParagraph)
        await clearStorage.load()
        this.element.appendChild(clearStorageParagraph)
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
        let search = new Search(this.element, "", 6, Search.ORDER_LATEST_READ, true, this.searchFunction)
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
        let search = new Search(this.element, "", 6, Search.ORDER_LATEST_ADDED, true, this.searchFunction)
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

        let search = new Search(this.searchList, term, 6, Search.ORDER_TITLE, true, (term) => this.search(term))
        await search.load()
    }

    async load() {
        await super.load()

        let searchSection = document.createElement("p")

        this.searchField = document.createElement("input")
        this.searchField.type = "text"
        searchSection.appendChild(this.searchField)

        this.searchButton = document.createElement("a")
        this.searchButton.innerHTML = "search"
        this.searchButton.onclick = () => this.search()
        searchSection.appendChild(this.searchButton)
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
            progressEnclosure.classList.add(this.CLASS_PROGRESS_ENCLOSURE)

            let progress = document.createElement("span")
            progress.style.position = "absolute"
            progress.style.display = "inline-block"
            progress.style.height = "80%"
            progress.style.width = (99 * (book.position / book.size)) + "%"
            progress.style.top = "10%"
            progress.style.left = "1%"
            progress.classList.add(this.CLASS_PROGRESS_BAR)

            progressEnclosure.appendChild(progress)
            return progressEnclosure
        } else {
            return null
        }
    }
    
    
    async getCoverItem(book) {
        let imageEnclosure = document.createElement("span")
        imageEnclosure.classList.add(this.CLASS_COVER_ENCLOSURE)

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

        let fontSize = width/rows[longestRow].length * 3
        context.font = fontSize + 'px "Merriweather"'
        while (context.measureText(rows[longestRow]).width > width - margin) {
            fontSize -= 1
            context.font = fontSize + 'px "Merriweather"'
        }

        let rowHeight = 0
        for (let i = 0; i < rows.length; i++) {
            let tm = context.measureText(rows[i])
            let height = tm.actualBoundingBoxAscent + tm.actualBoundingBoxDescent
            if (height > rowHeight) rowHeight = height
        }
        let rowSpacing = 10
        rowHeight = rowHeight + rowSpacing
        let totalHeight = rowHeight * rows.length

        for (let i = 0; i < rows.length; i++) {
            let h = (height/2) - (totalHeight/2) + (i+1) * rowHeight
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
        let bookItem = new BookItem(bookListItem, book, ! this.withCollections, this.searchFunction)
        await bookItem.load()
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
        this.hideLoading()
        this.bookList.update(books)
        if (this.multipage) {
            if (books.length == this.pageSize) {
                this.showNextButton()
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

class NumberSliderSetting extends Setting {
    constructor(element, name, minimumValue, maximumValue, step, defaultValue, unitOfMeasure = null) {
        super(element, name, defaultValue)
        this.minimumValue = minimumValue
        this.maximumValue = maximumValue
        this.step = step
        this.unitOfMeasure = unitOfMeasure
    }

    getUnitOfMeasure() {
        if (this.unitOfMeasure && this.unitOfMeasure != null) {
            return this.unitOfMeasure
        } else {
            return ""
        }
    }

    async load() {
        await super.load()

        let label = document.createElement("label")
        label.innerHTML = this.name
        label.forName = this.getKey()
        this.element.appendChild(label)

        let valueLabel = document.createElement("output")
        valueLabel.style.justifySelf = "right"
        valueLabel.innerHTML = this.get() + this.getUnitOfMeasure()
        this.element.appendChild(valueLabel)

        let input = document.createElement("input")
        input.style.gridColumn = "1/3"
        input.style.justifySelf = "auto"
        input.type = "range"
        input.name = this.getKey()
        input.min = this.minimumValue
        input.max = this.maximumValue
        input.step = this.step
        input.value = this.get()
        this.element.appendChild(input)
        
        input.oninput = () => {
            let originalValue = this.get()
            valueLabel.innerHTML = input.value + this.getUnitOfMeasure()
            if (input.value != originalValue) {
                valueLabel.classList.add(CLASS_HIGHLIGHTED)
            } else {
                valueLabel.classList.remove(CLASS_HIGHLIGHTED)
            }
        }
        input.onchange = () => {
            let value = input.value
            this.persist(value)
            valueLabel.innerHTML = value + this.getUnitOfMeasure()
            valueLabel.classList.remove(CLASS_HIGHLIGHTED)
            this.apply()
        }
        
    }
}

class TextSizeSetting extends NumberSliderSetting {
    constructor(element, name, minimumValue, maximumValue, step, defaultValue, controlledElement, applyCallback = null) {
        super(element, name, minimumValue, maximumValue, step, defaultValue)
        this.controlledElement = controlledElement
        this.applyCallback = applyCallback
        this.apply()
    }

    apply() {
        if (this.controlledElement) {
            this.controlledElement.style.fontSize = this.get() + "em"
            if (this.applyCallback) {
                timeout(1000).then(() => this.applyCallback())
            }
        }
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
        
        input.oninput = () => {
            let originalValue = this.get()
            let value = this.values[input.value]
            valueLabel.innerHTML = value
            if (value != originalValue) {
                valueLabel.classList.add(CLASS_HIGHLIGHTED)
            } else {
                valueLabel.classList.remove(CLASS_HIGHLIGHTED)
            }
        }
        input.onchange = () => {
            let value = this.values[input.value]
            this.persist(value)
            valueLabel.innerHTML = value
            valueLabel.classList.remove(CLASS_HIGHLIGHTED)
            this.apply()
        }
    }
}

class ThemeSliderSetting extends OptionsSliderSetting {
    constructor(element, dayStartSetting, dayEndSetting, lightHighlightedColorSetting, darkHighlightedColorSetting) {
        super(element, "theme", ["dark", "OS theme", "time based", "light"], "light")
        this.dayStartSetting = dayStartSetting
        this.dayEndSetting = dayEndSetting
        this.lightHighlightedColorSetting = lightHighlightedColorSetting
        this.darkHighlightedColorSetting = darkHighlightedColorSetting
        this.apply()
    }
    
    timeStringToDate(value) {
        return new Date((new Date()).toDateString() + " " + value)
    }

    apply() {
        if (this.dayStartSetting != undefined && this.dayEndSetting != undefined
            && this.lightHighlightedColorSetting != undefined && this.darkHighlightedColorSetting != undefined) {
            let value = this.get()
            if (value == "light") {
                document.body.classList.remove("dark")
                setStatusBarColor(this.lightHighlightedColorSetting.get())
            } else if (value == "dark") {
                document.body.classList.add("dark")
                setStatusBarColor(this.darkHighlightedColorSetting.get())
            } else if (value == "OS theme") {
                if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
                    document.body.classList.add("dark")
                    setStatusBarColor(this.darkHighlightedColorSetting.get())
                } else {
                    document.body.classList.remove("dark")
                    setStatusBarColor(this.lightHighlightedColorSetting.get())
                }
            } else if (value == "time based") {
                let dayStart = this.timeStringToDate(this.dayStartSetting.get())
                let dayEnd = this.timeStringToDate(this.dayEndSetting.get())
                let now = new Date()
                if (now < dayStart || dayEnd < now) {
                    document.body.classList.add("dark")
                    setStatusBarColor(this.darkHighlightedColorSetting.get())
                } else {
                    document.body.classList.remove("dark")
                    setStatusBarColor(this.lightHighlightedColorSetting.get())
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

class ControlWithConfirmation extends Component {
    constructor(element, text, confirmation, timeout) {
        super(element)
        this.text = text
        this.confirmation = confirmation
        this.timeout = timeout
    }

    async load() {
        await super.load()

        let button = document.createElement("a")
        console.log(this.text)
        button.innerHTML = this.text
        this.element.appendChild(button)

        let confirmationButton = document.createElement("a")
        confirmationButton.innerHTML = this.confirmation
        confirmationButton.classList.add(CLASS_HIGHLIGHTED)
        confirmationButton.style.display = "none"
        this.element.appendChild(confirmationButton)

        button.onclick = () => {
            button.style.display = "none"
            confirmationButton.style.display = "inline-block"
            timeout(this.timeout).then(() => {
                confirmationButton.style.display = "none"
                button.style.display = "inline-block"
            })
        }
        confirmationButton.onclick = () => {
            this.execute()
            confirmationButton.style.display = "none"
            button.style.display = "inline-block"
        }
    }

    execute() {
        console.log("not implemented")
    }
}

class ClearStorageControl extends ControlWithConfirmation {
    constructor(element) {
        super(element, "Clear storage", "Click if you are sure you want to clear storage", 5000)
        console.log("created clear storage")
    }
    async load() {
        await super.load()
    }
    execute() {
        window.localStorage.clear()
        window.location.reload()
    }
}

async function initializeSettings(contentElement) {
    let dayStartSetting = new TimeSetting(null, "day start", "07:00")
    let dayEndSetting = new TimeSetting(null, "day end", "21:00")
    let lightHighlightedColorSetting = new ColorSetting(null, "light theme highlight color", "#FFD700")
    let darkHighlightedColorSetting = new ColorSetting(null, "dark theme highlight color", "#FFD700")
    let themeSetting = new ThemeSliderSetting(null, dayStartSetting, dayEndSetting, lightHighlightedColorSetting, darkHighlightedColorSetting)
    dayStartSetting.chainedSettings = [themeSetting]
    dayEndSetting.chainedSettings = [themeSetting]
    lightHighlightedColorSetting.chainedSettings = [themeSetting]
    darkHighlightedColorSetting.chainedSettings = [themeSetting]
    let textSizeSetting = new TextSizeSetting(null, "text size", 0.5, 2, 0.1, 1, contentElement)
    let downloadSizeSetting = new NumberSliderSetting(null, "maximum download size", 50, 200, 10, 100, " MB")
    let settings = [
        textSizeSetting,
        dayStartSetting,
        dayEndSetting,
        themeSetting,
        downloadSizeSetting,
        new ColorSetting(null, "light theme background color", "#ffffff"),
        new ColorSetting(null, "light theme text color", "#000000"),
        lightHighlightedColorSetting,
        new ColorSetting(null, "light theme highlight text color", "#000000"),
        new ColorSetting(null, "light theme error color", "#dc143c"),
        new ColorSetting(null, "light theme error text color", "#FFFFFF"),
        new ColorSetting(null, "light theme success color", "#008000"),
        new ColorSetting(null, "light theme success text color", "#FFFFFF"),

        new ColorSetting(null, "dark theme background color", "#000000"),
        new ColorSetting(null, "dark theme text color", "#ffffff"),
        darkHighlightedColorSetting,
        new ColorSetting(null, "dark theme highlight text color", "#000000"),
        new ColorSetting(null, "dark theme error color", "#dc143c"),
        new ColorSetting(null, "dark theme error text color", "#FFFFFF"),
        new ColorSetting(null, "dark theme success color", "#008000"),
        new ColorSetting(null, "dark theme success text color", "#FFFFFF")
    ]
    return {
        themeSetting: themeSetting,
        textSizeSetting: textSizeSetting,
        downloadSizeSetting: downloadSizeSetting,
        allSettings: settings
    }
}