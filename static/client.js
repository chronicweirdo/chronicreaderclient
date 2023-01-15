var CLASS_SUCCESS = "success"
var CLASS_ERROR = "error"
var CLASS_HIGHLIGHTED = "highlighted"
var CLASS_INVERSE_HIGHLIGHTED = "highlighted_inverse"

class SingletonInterface {
    static factory(...args) {
        if (this.INSTANCE == undefined) {
            this.INSTANCE = new this(...args)
        }
        return this.INSTANCE
    }
}

const AsSingleton = (C) => class extends C {
    static factory(...args) {
        if (this.INSTANCE == undefined) {
            this.INSTANCE = new this(...args)
        }
        return this.INSTANCE
    }
}

const AsOrientationListener = (C) => class extends C {
    isLandscape() {
        this.initMediaQuery()
        return this.isInLandscape.matches
    }
    isPortrait() {
        this.initMediaQuery()
        return this.isInLandscape.matches == false
    }
    applyMediaQuery() {
        this.initMediaQuery()
        if (this.isInLandscape.matches) {
            this.applyLandscape()
        } else {
            this.applyPortrait()
        }
    }

    initMediaQuery() {
        if (this.isInLandscape == undefined) {
            this.isInLandscape = window.matchMedia("(orientation: landscape)")
            this.isInLandscape.addEventListener("change", () => this.applyMediaQuery())
        }
    }

    onLandscape(func) {
        this.initMediaQuery()
        if (this.landscapeFunctions == undefined) {
            this.landscapeFunctions = []
        }
        this.landscapeFunctions.push(func)
    }

    onPortrait(func) {
        this.initMediaQuery()
        if (this.portraitFunctions == undefined) {
            this.portraitFunctions = []
        }
        this.portraitFunctions.push(func)
    }

    onOrientation(landscapeFunc, portraitFunc) {
        this.onLandscape(landscapeFunc)
        this.onPortrait(portraitFunc)
    }

    applyLandscape() {
        for (let i in this.landscapeFunctions) {
            this.landscapeFunctions[i]()
        }
    }

    applyPortrait() {
        for (let i in this.portraitFunctions) {
            this.portraitFunctions[i]()
        }
    }
}

function timeout(ms) {
    return new Promise((resolve, reject) => {
        window.setTimeout(function() {
            resolve()
        }, ms)
    })
}

function getBookLink(book) {
    return "read.html?book=" + book.id
}

function idTimeout(id, ms) {
    if (document.timeoutId == undefined) document.timeoutId = {}
    let triggeredTimestamp = Date.now()
    document.timeoutId[id] = triggeredTimestamp
    return new Promise((resolve, reject) => {
        window.setTimeout(() => {
            if (document.timeoutId[id] === triggeredTimestamp) {
                resolve()
            } else {
                reject()
            }
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
    constructor() {
    }

    createElement(kind, parent = null) {
        if (parent == null) {
            // create inside the compoent element
            if (this.element != undefined && this.element != null) {
                let el = document.createElement(kind)
                this.element.appendChild(el)
                return el
            }
        } else {
            let el = document.createElement(kind)
            parent.appendChild(el)
            return el
        }
        return null
    }

    async load(element) {
        if (element != undefined && element != null) {
            this.element = element
        }
        if (this.element != undefined && this.element != null) {
            this.element.innerHTML = ""
            Array.from(this.element.classList)
                .forEach(c => this.element.classList.remove(c))
        }
    }

    async update(data) {
    }
}

class TabsList extends Component {
    STORAGE_KEY = "tabbed_page_latest_tab"

    constructor(tabs) {
        super();
        this.tabs = tabs;
    }

    saveSelected(tab) {
        this.selectedTab = tab
        window.localStorage.setItem(this.STORAGE_KEY, tab.name);
    }

    loadSelected() {
        if (this.selectedTab != undefined) {
            return this.selectedTab
        } else {
            let selectedName = window.localStorage.getItem(this.STORAGE_KEY);
            if (selectedName != undefined && selectedName != null) {
                for (let tab of this.tabs) {
                    if (tab.name === selectedName) {
                        this.selectedTab = tab
                        return this.selectedTab
                    }
                }
            }
            this.selectedTab = this.tabs[0]
            return this.selectedTab
        }
    }
}

class TabsMenu extends TabsList {
    CLASS_MENU = "tabs_menu"

    constructor(tabs) {
        super(tabs);
    }

    async selectTab(name, ...args) {
        let selectedTab = null
        for (let tab of this.tabs) {
            tab.button.classList.remove(CLASS_INVERSE_HIGHLIGHTED)
            tab.button.classList.add(CLASS_HIGHLIGHTED)
            if (tab.name == name) {
                selectedTab = tab
            }
        }
        if (selectedTab != null) {
            selectedTab.button.classList.remove(CLASS_HIGHLIGHTED)
            selectedTab.button.classList.add(CLASS_INVERSE_HIGHLIGHTED)
            this.saveSelected(selectedTab);
            if (selectedTab.action != undefined) await selectedTab.action(...args);
        }
    }

    async load(element) {
        await super.load(element);

        this.element.style.display = "block"
        this.element.style.marginBottom = "1.4285vw"
        this.element.classList.add(CLASS_HIGHLIGHTED)

        let buttons = this.createElement("div");
        buttons.classList.add(this.CLASS_MENU);

        for (let tab of this.tabs) {
            let button = this.createElement("a", buttons);
            tab.button = button
            button.innerHTML = tab.name;
            button.style.display = "inline-block";
            button.style.padding = ".4em";
            button.style.cursor = "pointer";

            button.onclick = () => this.selectTab(tab.name, tab.args);
        }

        let selectedTab = this.loadSelected()
        await this.selectTab(selectedTab.name, selectedTab.args)
    }
}

class TabsDropdown extends TabsList {
    CLASS_TABS_DROPDOWN = "tabs_dropdown"
    constructor(tabs) {
        super(tabs);
    }

    async selectTab(name, ...args) {
        for (let tab of this.tabs) {
            if (tab.name == name) {
                this.saveSelected(tab);
                this.collapse()
                if (tab.action != undefined) await tab.action(...args);
                return;
            }
        }
    }

    expand() {
        let selectedTab = this.loadSelected()
        for (let tab of this.tabs) {
            tab.listItem.style.display = "list-item"
            if (tab == selectedTab) {
                tab.button.classList.remove(CLASS_HIGHLIGHTED)
                tab.button.classList.add(CLASS_INVERSE_HIGHLIGHTED)
            } else {
                tab.button.classList.remove(CLASS_INVERSE_HIGHLIGHTED)
                tab.button.classList.add(CLASS_HIGHLIGHTED)
            }
        }
        this.expandButton.innerHTML = "▲"
        this.expanded = true
    }

    collapse() {
        let selectedTab = this.loadSelected()
        for (let tab of this.tabs) {
            if (tab == selectedTab) {
                tab.listItem.style.display = "list-item"
                tab.button.classList.remove(CLASS_INVERSE_HIGHLIGHTED)
                tab.button.classList.add(CLASS_HIGHLIGHTED)
            } else {
                tab.listItem.style.display = "none"
            }
        }
        this.expandButton.innerHTML = "▼"
        this.expanded = false
    }

    async load(element) {
        super.load(element);

        this.element.classList.add(this.CLASS_TABS_DROPDOWN)
        this.element.style.marginBottom = "2.5vw"
        this.element.style.display = "grid"
        this.element.style.gridTemplateColumns = "50px auto"
        this.element.classList.add(CLASS_HIGHLIGHTED)
        

        this.expanded = false
        this.expandButton = this.createElement("a");
        this.expandButton.style.display = "inline-block"
        this.expandButton.style.padding = "2.5vw";
        this.expandButton.classList.add(CLASS_HIGHLIGHTED)
        this.expandButton.style.textDecoration = "none";
        this.expandButton.innerHTML = "▼"
        this.expandButton.onclick = () => {
            if (this.expanded) {
                this.collapse()
            } else {
                this.expand()
            }
        }
        
        this.tabList = this.createElement("ul")
        this.tabList.style.listStyle = "none"

        for (let tab of this.tabs) {
            let item = this.createElement("li", this.tabList);
            item.style.display = "none"
            tab.listItem = item
            let button = this.createElement("a", item);
            tab.button = button
            button.innerHTML = tab.name;
            button.style.display = "inline-block";
            button.style.padding = "2.5vw";
            item.style.display = "none"
            button.style.cursor = "pointer";

            button.onclick = () => this.selectTab(tab.name, tab.args);
        }

        let selectedTab = this.loadSelected()
        await this.selectTab(selectedTab.name, selectedTab.args)
    }
}

class TabbedPage extends AsOrientationListener(Component) {
    
    constructor() {
        super()
    }

    async load(element) {
        await super.load(element)

        let tabBar = this.createElement("div")
        let tabsComponent = null;

        this.content = this.createElement("div")

        let searchTabName = "search"
        let searchTab = new LibrarySearchTab()
        let globalSearchFunction = (term) => {
            tabsComponent.selectTab(searchTabName, term)
        }

        let tabs = [
            {
                name: "on device",
                action: async () => new OnDeviceTab(globalSearchFunction).load(this.content)
            },
            {
                name: "latest read",
                action: async () => new LatestReadTab(globalSearchFunction).load(this.content)
            },
            {
                name: "latest added",
                action: async () => new LatestAddedTab(globalSearchFunction).load(this.content)
            },
            {
                name: searchTabName,
                action: async (term) => searchTab.load(this.content).then(() => searchTab.search(term))
            },
            {
                name: "collections",
                action: async () => new CollectionsTab(globalSearchFunction).load(this.content)
            },
            {
                name: "settings",
                action: async () => new SettingsTab().load(this.content)
            }
        ]

        this.onOrientation(_ => {
            tabsComponent = new TabsMenu(tabs)
            tabsComponent.load(tabBar)
        }, _ => {
            tabsComponent = new TabsDropdown(tabs)
            tabsComponent.load(tabBar)
        })
        this.applyMediaQuery()
    }
}

class FormComponent extends Component {
    CLASS_FORM_ROW = "form_row"
    constructor() {
        super()
    }

    title(text) {
        let h = document.createElement("h1")
        h.innerHTML = text
        h.classList.add(CLASS_HIGHLIGHTED)
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

    async load(element) {
        await super.load(element)
    }
}

class UploadForm extends FormComponent {
    constructor() {
        super()
    }

    async load(element) {
        await super.load(element)

        this.element.appendChild(this.title("File Upload"))

        let fileInput = this.file("filename")
        this.element.appendChild(this.p(fileInput))

        let uploadResult = document.createElement("span")
        uploadResult.style.display = "none"
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
                uploadResult.classList.remove(...uploadResult.classList)
                uploadResult.style.display = "inline-block"
                if (result == true) {
                    uploadResult.innerHTML = "file upload was successful"
                    uploadResult.classList.add(CLASS_SUCCESS)
                } else {
                    uploadResult.innerHTML = "file upload failed"
                    uploadResult.classList.add(CLASS_ERROR)
                }
                timeout(5000).then(() => {
                    uploadResult.innerHTML = ""
                    uploadResult.style.display = "none"
                })
            })
        }
        this.element.appendChild(this.p(button, uploadResult))
    }
}

class LoginForm extends FormComponent {
    constructor() {
        super()
    }

    async load(element) {
        await super.load(element)

        this.element.appendChild(this.title("Server Connection"))

        let serverConnection = this.p(null)
        serverConnection.style.display = "block"
        serverConnection.style.overflowWrap = "anywhere"
        serverConnection.style.padding = "0.4em"
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
        loginResult.style.display = "none"

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
                return response.json()
            })
            .then(result => {
                loginResult.classList.remove(...loginResult.classList)
                loginResult.style.display = "inline-block"
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
                    loginResult.style.display = "none"
                })
            })
        }
        this.element.appendChild(this.p(button, loginResult))

        verifyConnection()
    }
}

class SettingsTab extends Component {
    constructor() {
        super()
    }

    async load(element) {
        await super.load(element)

        await new LoginForm().load(this.createElement("div"))

        await new UploadForm().load(this.createElement("div"))

        let settingsTitle = this.createElement("h1")
        settingsTitle.innerHTML = "Settings"
        settingsTitle.classList.add(CLASS_HIGHLIGHTED)

        ShowTitlesSetting.factory().load(this.createElement("p"))
        TextSizeSetting.factory().load(this.createElement("p"))
        DayStartSetting.factory().load(this.createElement("p"))
        DayEndSetting.factory().load(this.createElement("p"))
        ThemeSliderSetting.factory().load(this.createElement("p"))
        DownloadSizeSetting.factory().load(this.createElement("p"))
        
        LightThemeBackgroundColorSetting.factory().load(this.createElement("p"))
        LightThemeTextColorSetting.factory().load(this.createElement("p"))
        LightThemeHighlightColorSetting.factory().load(this.createElement("p"))
        LightThemeHighlightTextColorSetting.factory().load(this.createElement("p"))
        LightThemeErrorColorSetting.factory().load(this.createElement("p"))
        LightThemeSuccessColorSetting.factory().load(this.createElement("p"))

        DarkThemeBackgroundColorSetting.factory().load(this.createElement("p"))
        DarkThemeTextColorSetting.factory().load(this.createElement("p"))
        DarkThemeHighlightColorSetting.factory().load(this.createElement("p"))
        DarkThemeHighlightTextColorSetting.factory().load(this.createElement("p"))
        DarkThemeErrorColorSetting.factory().load(this.createElement("p"))
        DarkThemeSuccessColorSetting.factory().load(this.createElement("p"))
        
        await new ClearStorageControl().load(this.createElement("p"))
    }
}

class OnDeviceTab extends Component {
    constructor(searchFunction = null) {
        super()
        this.searchFunction = searchFunction
    }

    async load(element) {
        await super.load(element)

        await fetch("/books")
            .then(response => response.json())
            .then((books) => {
                if (books != undefined && books != null
                    && books.length > 0) {
                
                    let list = new BookList(false, this.searchFunction)
                    list.load(this.element).then(() => list.update(books))
                } else {
                    let noBooks = this.createElement("p")
                    noBooks.innerHTML = "no books on device"
                    noBooks.style.textAlign = "center"
                }
            })
    }
}

class LatestReadTab extends Component {
    constructor(searchFunction = null) {
        super()
        this.searchFunction = searchFunction
    }

    async load(element) {
        await super.load(element)
        let search = new Search("", 12, Search.ORDER_LATEST_READ, true, this.searchFunction, false)
        await search.load(this.element)
    }
}

class LatestAddedTab extends Component {
    constructor(searchFunction = null) {
        super()
        this.searchFunction = searchFunction
    }

    async load(element) {
        await super.load(element)
        let search = new Search("", 12, Search.ORDER_LATEST_ADDED, true, this.searchFunction)
        await search.load(this.element)
    }
}

class LibrarySearchTab extends Component {
    CLASS_SEARCH_SECTION = "search_section"
    constructor() {
        super()
    }

    async search(term = null) {
        if (term == null) {
            term = this.searchField.value
        } else {
            this.searchField.value = term
        }

        let search = new Search(term, 12, Search.ORDER_TITLE, true, (term) => this.search(term))
        await search.load(this.searchList)
    }

    async load(element) {
        await super.load(element)

        let searchSection = this.createElement("p")
        searchSection.style.textAlign = "center"

        this.searchField = this.createElement("input", searchSection)
        this.searchField.type = "text"
        this.searchField.style.width = "92vw"
        this.searchField.addEventListener("keyup", (event) => {
            console.log(event)
            if (event.key === "Enter") {
                event.preventDefault()
                this.search()
            } else {
                idTimeout("searchField", 1500).then(() => this.search()).catch(() => {})
            }
        })
        this.searchField.focus()

        this.searchList = this.createElement("div")
    }
}

class CollectionsTab extends Component {
    COLLECTIONS_TREE_CLASS = "collections_tree"
    constructor(searchFunction = null) {
        super()
        this.searchFunction = searchFunction
    }

    createCollectionTree(node, root = false) {
        let list = document.createElement("ul")
        if (root) {
            list.style.display = "block"
        } else {
            list.style.display = "none"
        }
        list.style.listStyleType = "none"

        if (node.children) {
            for (let i in node.children) {
                let c = node.children[i]
                let li = document.createElement("li")

                let pip = document.createElement("span")
                if (c.children) {
                    pip.innerHTML = "+"
                    pip.style.cursor = "pointer"
                } else {
                    pip.innerHTML = "-"
                }
                li.appendChild(pip)

                let label = document.createElement("a")
                let labelParts = c.label.split("/")
                label.innerHTML = labelParts[labelParts.length - 1]
                if (this.searchFunction) {
                    label.onclick = () => this.searchFunction(c.label)
                }
                li.appendChild(label)

                if (c.children) {
                    let childrenList = this.createCollectionTree(c)
                    li.appendChild(childrenList)

                    pip.onclick = () => {
                        if (childrenList.style.display == "none") {
                            childrenList.style.display = "block"
                            pip.innerHTML = "-"
                        } else {
                            childrenList.style.display = "none"
                            pip.innerHTML = "+"
                        }
                    }
                }
                
                list.appendChild(li)
            }
        }
        return list
    }

    async load(element) {
        await super.load(element)

        let collectionsResponse = await fetch("/collections")
        if (collectionsResponse.status == 200) {
            let collections = await collectionsResponse.json()
            if (collections != null) {
                if (collections.children != undefined) {
                    
                    this.element.classList.add(this.COLLECTIONS_TREE_CLASS)
                    this.element.appendChild(this.createCollectionTree(collections, true))
                } else {
                    let noCollectionsMessage = this.createElement("p")
                    noCollectionsMessage.innerHTML = "no collections"
                    noCollectionsMessage.style.textAlign = "center"
                }
            } else {
                let error = this.createElement("p")
                error.classList.add(CLASS_ERROR)
                error.innerHTML = "there was an error loading collections"
            }
        }
    }
}

class CoverItem extends AsOrientationListener(Component) {
    CLASS_PROGRESS_ENCLOSURE = "progress_enclosure"
    CLASS_PROGRESS_CHECKMARK = "progress_checkmark"
    CLASS_PROGRESS_BAR = "progress_bar"
    CLASS_COVER_ENCLOSURE = "cover_enclosure"

    constructor(book) {
        super()
        this.book = book
    }

    getCheckmarkSvg() {
        let namespace = "http://www.w3.org/2000/svg"
        let svg = document.createElementNS(namespace, "svg")
        svg.setAttribute("viewBox", "0 0 12 10")
        svg.setAttribute("preserveAspectRatio", "xMidYMid")

        let path = document.createElementNS(namespace, "path")
        path.setAttribute("d", "M 3 3 L 1 5 L 5 9 L 11 3 L 9 1 L 5 5 Z ")
        path.setAttribute("stroke-width", "0.4")
        path.setAttribute("stroke-linecap", "round")
        
        svg.appendChild(path)

        return svg
    }

    getProgressItem(book) {
        if (book.position) {
            let progressFraction = (book.position <= book.size) ? book.position / book.size : 1
            if (book.completed) {
                progressFraction = 1
            }
            let progressEnclosure = null
            if (progressFraction == 1) {
                let checkmark = this.getCheckmarkSvg()
                progressEnclosure = checkmark
                progressEnclosure.style.position = "absolute"
                progressEnclosure.style.width = "25%"
                progressEnclosure.style.height = "15%"
                progressEnclosure.style.bottom = "0%"
                progressEnclosure.style.right = "0%"
                progressEnclosure.style.display = "inline-block"
                progressEnclosure.classList.add(this.CLASS_PROGRESS_CHECKMARK)
            } else {
                progressEnclosure = document.createElement("span")
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
                progress.style.width = (98 * progressFraction) + "%"
                progress.style.top = "10%"
                progress.style.left = "1%"
                progress.classList.add(this.CLASS_PROGRESS_BAR)
                progressEnclosure.appendChild(progress)
            }

            return progressEnclosure
        } else {
            return null
        }
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

    async load(element) {
        await super.load(element)

        //let imageEnclosure = document.createElement("span")
        this.element.classList.add(this.CLASS_COVER_ENCLOSURE)
        this.element.style.overflow = "hidden"
        this.element.style.position = "relative"
        this.element.style.display = "block"
        this.onOrientation(_ => {
            this.element.style.height = "24vw" /* (8/5*15) */
        }, _ => {
            this.element.style.height = "48vw" /* (8/5*30) */
        })

        let image = document.createElement("img")
        if (this.book.cover == null) {
            image.src = await this.createBookCover(this.book.id, this.book.title, 500, 800)
        } else {
            image.src = this.book.cover
        }
        image.style.height = '100%'
        image.style.position = "relative"
        this.element.appendChild(image)

        image.onload = () => {
            timeout(2).then(() => {
                image.style.left = (- (image.width - image.parentElement.offsetWidth) / 2) + "px"
            })
        }

        let progressItem = this.getProgressItem(this.book)
        if (progressItem != null) {
            this.element.appendChild(progressItem)
        }

        this.applyMediaQuery()
    }
}

class TitleItem extends Component {
    constructor(book, withCollection, searchFunction) {
        super()
        this.book = book
        this.withCollection = withCollection
        this.searchFunction = searchFunction
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

    async load(element) {
        await super.load(element)
        
        this.element.style.overflowWrap = "anywhere"
        this.element.style.fontSize = ".8em"
        if (this.withCollection == true) {
            let items = TitleItem.getCollectionItems(this.book.collection, this.searchFunction)
            for (let i of items) {
                this.element.appendChild(i)
            }
            if (items.length > 0) {
                let slash = this.createElement("span")
                slash.innerHTML = "/"
            }
            let actualTitle = this.createElement("a")
            actualTitle.innerHTML = this.book.title
            actualTitle.href = getBookLink(this.book)
        } else {
            let title = this.createElement("a")
            title.innerHTML = this.book.title
            title.href = getBookLink(this.book)
        }
    }
}

class BookItem extends Component {
    constructor(book, withTitle, withCollection, searchFunction = null) {
        super()
        this.book = book
        this.withTitle = withTitle
        this.withCollection = withCollection
        this.searchFunction = searchFunction
    }
     
    async getCoverItem(book) {
        
    }

    async load(element) {
        await super.load(element)
        if (this.element.tagName != "LI") throw "book item must be applied to li"

        this.element.style.width = '100%'
        this.element.style.overflow = 'hidden'

        let itemLink = this.createElement("a")
        itemLink.style.overflow = 'hidden'
        itemLink.style.position = 'relative'
        itemLink.href = getBookLink(this.book)
        
        new CoverItem(this.book).load(this.createElement("span", itemLink))

        if (this.withTitle) {
            new TitleItem(this.book, this.withCollection, this.searchFunction).load(this.createElement("span"))
        }
    }
}

class BookList extends AsOrientationListener(Component) {
    static SEED_MAX = parseInt("ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff", 16)
    CLASS_BOOK_LIST = "book_list"

    constructor(withCollections = false, searchFunction = null) {
        super()
        this.withTitles = ShowTitlesSetting.factory().get()
        this.withCollections = withCollections
        this.searchFunction = searchFunction
        this.bookCount = 0
    }

    getBookCount() {
        return this.bookCount
    }

    async load(element) {
        await super.load(element)
        this.applyMediaQuery()
    }

    createTitle(collection) {
        let title = document.createElement("h1")
        title.style.overflowWrap = "anywhere"
        if (this.searchFunction != undefined && this.searchFunction != null) {
            let items = TitleItem.getCollectionItems(collection, this.searchFunction)
            for (let i of items) {
                title.appendChild(i)
            }
        } else {
            title.innerHTML = collection
        }
        return title
    }

    createListElement() {
        /*
        ul.book_list {
            padding: 0;
            list-style-type: none;
            display: grid;
            grid-template-columns: 30vw 30vw 30vw;
            column-gap: 2.5vw;
            row-gap: 2.5vw;
            margin-left: 2.5vw;
        }
        */
        /*ul.book_list {
                grid-template-columns: repeat(6, 15vw);
                column-gap: 1.4285vw;
                row-gap: 1.4285vw;
                margin-left: 1.4285vw;
            }*/
        let list = document.createElement('ul')
        list.style.padding = "0"
        list.style.listStyleType = "none"
        list.style.display = "grid"
        this.onOrientation(_ => {
            let spacing = "1.4285vw"
            list.style.gridTemplateColumns = "repeat(6, 15vw)"
            list.style.columnGap = spacing
            list.style.rowGap = spacing
            list.style.marginLeft = spacing
        }, _ => {
            let spacing = "2.5vw"
            list.style.gridTemplateColumns = "repeat(3, 30vw)"
            list.style.columnGap = spacing
            list.style.rowGap = spacing
            list.style.marginLeft = spacing
        })
        list.classList.add(this.CLASS_BOOK_LIST)
        this.applyMediaQuery()
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

        await new BookItem(book, this.withTitles, ! this.withCollections, this.searchFunction)
            .load(this.createElement("li", parent))
        this.bookCount += 1
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

    constructor(term, pageSize, order, multipage, collectionLinkFunction = null, completed = null) {
        super()
        this.term = term
        this.pageSize = pageSize
        this.order = order
        this.multipage = multipage
        this.completed = completed
        this.collectionLinkFunction = collectionLinkFunction
    }

    getUrl() {
        return "search?" + new URLSearchParams({
            term: this.term,
            page: this.page,
            pageSize: this.pageSize,
            order: this.order,
            completed: this.completed
        })
    }

    createNextButton() {
        let p = document.createElement("p")
        let button = document.createElement("a")
        button.innerHTML = "next"
        p.style.display = "none"
        p.style.textAlign = "center"
        p.style.marginTop = "1em"
        button.onclick = () => {
            this.nextSearch()
        }
        p.appendChild(button)
        return p
    }

    createLoading() {
        let p = document.createElement("p")
        p.innerHTML = "Loading..."
        p.style.display = "none"
        p.style.textAlign = "center"
        p.style.marginTop = "1em"
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
        errorMessage.style.display = "none"
        errorMessage.style.padding = "0.4em"
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
                    if (searchResult.length > 0) {
                        this.addBooksToResult(searchResult)
                    } else if (this.bookList.getBookCount() == 0) {
                        this.showNothingFoundMessage()
                    }
                } else {
                    this.showErrorMessage()
                }
            })
    }

    showNothingFoundMessage() {
        this.hideLoading()
        if (this.nothingFoundMessage == undefined) {
            let noBooks = this.createElement("p")
            noBooks.innerHTML = "no books found"
            noBooks.style.textAlign = "center"
            this.nothingFoundMessage = noBooks
        }
    }

    async load(element) {
        await super.load(element)
        let withCollectionSections = (this.order == Search.ORDER_TITLE)

        this.bookList = new BookList(withCollectionSections, this.collectionLinkFunction)
        await this.bookList.load(this.createElement("div"))

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

class Setting extends AsSingleton(Component) {
    /*static INST = []

    static getInstances() {
        let instances = []
        for (let i = 0; i < Setting.INST.length; i++) {
            let setting = Setting.INST[i]
            if (setting.constructor.name == this.name.toString()) {
                instances.push(setting)
            }
        }
        return instances
    }
    static factory(...args) {
        let instances = this.getInstances()
        if (instances.length > 0) {
            if (args.length == 1) {
                // first argument is always an element, we replace it if it exists
                instances[0].element = args[0]
            }
            return instances[0]
        } else {
            let setting = new this(...args)
            return setting
        }
    }*/

    CLASS_SETTING = "setting"
    constructor(name, defaultValue = null) {
        super()
        this.name = name
        this.defaultValue = defaultValue
        this.apply()
        //Setting.INST.push(this)
    }

    async load(element) {
        await super.load(element)

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
    }
}

class ColorSetting extends Setting {
    constructor(name, defaultValue = "#ffffff") {
        super(name, defaultValue)
    }

    async load(element) {
        await super.load(element)

        let label = this.createElement("label")
        label.innerHTML = this.name
        label.forName = this.getKey()

        let input = this.createElement("input")
        input.style.justifySelf = "right"
        input.type = "color"
        input.name = this.getKey()
        input.value = this.get()
        
        input.onchange = () => {
            this.persist(input.value)
            this.apply()
        }
    }

    apply() {
        document.documentElement.style.setProperty("--" + this.getKey(), this.get())
    }
}

class LightThemeBackgroundColorSetting extends ColorSetting {
    constructor() {
        super("light theme background color", "#ffffff")
    }
}
class LightThemeTextColorSetting extends ColorSetting {
    constructor() {
        super("light theme text color", "#000000")
    }
}
class LightThemeHighlightColorSetting extends ColorSetting {
    constructor() {
        super("light theme highlight color", "#FFD700")
    }
    apply() {
        super.apply()
    }
}
class LightThemeHighlightTextColorSetting extends ColorSetting {
    constructor() {
        super("light theme highlight text color", "#000000")
    }
}
class LightThemeErrorColorSetting extends ColorSetting {
    constructor() {
        super("light theme error color", "#dc143c")
    }
}
class LightThemeErrorTextColorSetting extends ColorSetting {
    constructor() {
        super(element, "light theme error text color", "#FFFFFF")
    }
}
class LightThemeSuccessColorSetting extends ColorSetting {
    constructor() {
        super("light theme success color", "#008000")
    }
}
class LightThemeSuccessTextColorSetting extends ColorSetting {
    constructor() {
        super("light theme success text color", "#FFFFFF")
    }
}
class DarkThemeBackgroundColorSetting extends ColorSetting {
    constructor() {
        super("dark theme background color", "#000000")
    }
}
class DarkThemeTextColorSetting extends ColorSetting {
    constructor() {
        super("dark theme text color", "#ffffff")
    }
}
class DarkThemeHighlightColorSetting extends ColorSetting {
    constructor() {
        super("dark theme highlight color", "#FFD700")
    }
    apply() {
        super.apply()
    }
}
class DarkThemeHighlightTextColorSetting extends ColorSetting {
    constructor() {
        super("dark theme highlight text color", "#000000")
    }
}
class DarkThemeErrorColorSetting extends ColorSetting {
    constructor() {
        super("dark theme error color", "#dc143c")
    }
}
class DarkThemeErrorTextColorSetting extends ColorSetting {
    constructor() {
        super("dark theme error text color", "#FFFFFF")
    }
}
class DarkThemeSuccessColorSetting extends ColorSetting {
    constructor() {
        super("dark theme success color", "#008000")
    }
}
class DarkThemeSuccessTextColorSetting extends ColorSetting {
    constructor() {
        super("dark theme success text color", "#FFFFFF")
    }
}

class NumberSliderSetting extends Setting {
    constructor(name, minimumValue, maximumValue, step, defaultValue, unitOfMeasure = null) {
        super(name, defaultValue)
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

    async load(element) {
        await super.load(element)

        let label = this.createElement("label")
        label.innerHTML = this.name
        label.forName = this.getKey()

        let valueLabel = this.createElement("output")
        valueLabel.style.justifySelf = "right"
        valueLabel.innerHTML = this.get() + this.getUnitOfMeasure()

        let input = this.createElement("input")
        input.style.gridColumn = "1/3"
        input.style.justifySelf = "auto"
        input.type = "range"
        input.name = this.getKey()
        input.min = this.minimumValue
        input.max = this.maximumValue
        input.step = this.step
        input.value = this.get()
        
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

class DownloadSizeSetting extends NumberSliderSetting {
    constructor() {
        super("maximum download size", 50, 200, 10, 100, " MB")
    }
}

class TextSizeSetting extends NumberSliderSetting {
    constructor(controlledElementId = "content", applyCallback = null) {
        super("text size", 0.5, 2, 0.1, 1)
        this.controlledElement = document.getElementById(controlledElementId)
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
    constructor(name, values, defaultValue) {
        super(name, defaultValue)
        this.values = values
    }

    async load(element) {
        await super.load(element)

        let label = this.createElement("label")
        label.innerHTML = this.name
        label.forName = this.getKey()

        let valueLabel = this.createElement("output")
        valueLabel.style.justifySelf = "right"
        valueLabel.innerHTML = this.get()

        let input = this.createElement("input")
        input.style.gridColumn = "1/3"
        input.style.justifySelf = "auto"
        input.type = "range"
        input.name = this.getKey()
        input.min = 0
        input.max = this.values.length - 1
        input.step = 1
        input.value = this.values.indexOf(this.get())
        
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
    constructor() {
        super("theme", ["dark", "OS theme", "time based", "light"], "light")
        this.apply()
    }
    
    timeStringToDate(value) {
        return new Date((new Date()).toDateString() + " " + value)
    }

    setDarkTheme() {
        document.body.classList.add("dark")
        if (document.statusBarMode != undefined && document.statusBarMode == "highlighted") {
            setStatusBarColor(DarkThemeHighlightColorSetting.factory().get())
        } else {
            setStatusBarColor(DarkThemeBackgroundColorSetting.factory().get())
        }
    }

    setLightTheme() {
        document.body.classList.remove("dark")
        if (document.statusBarMode != undefined && document.statusBarMode == "highlighted") {
            setStatusBarColor(LightThemeHighlightColorSetting.factory().get())
        } else {
            setStatusBarColor(LightThemeBackgroundColorSetting.factory().get())
        }
    }

    apply() {
        let value = this.get()
        if (value == "light") {
            this.setLightTheme()
        } else if (value == "dark") {
            this.setDarkTheme()
        } else if (value == "OS theme") {
            if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
                this.setDarkTheme()
            } else {
                this.setLightTheme()
            }
        } else if (value == "time based") {
            let dayStart = this.timeStringToDate(DayStartSetting.factory().get())
            let dayEnd = this.timeStringToDate(DayEndSetting.factory().get())
            console.log(dayStart + " " + dayEnd)
            let now = new Date()
            if (now < dayStart || dayEnd < now) {
                this.setDarkTheme()
            } else {
                this.setLightTheme()
            }
        }
    }
}

class CheckSetting extends Setting {
    constructor(name, defaultValue) {
        super(name, defaultValue)
    }

    async load(element) {
        await super.load(element)

        let label = this.createElement("label")
        label.innerHTML = this.name
        label.forName = this.getKey()

        let input = this.createElement("input")
        input.style.justifySelf = "right"
        input.style.height = "1em"
        input.style.width = "1em"
        input.type = "checkbox"
        input.name = this.getKey()
        input.checked = this.get()

        input.onchange = () => {
            this.persist(input.checked)
            this.apply()
        }
    }

    apply() {
        super.apply()
    }
}

class ShowTitlesSetting extends CheckSetting {
    constructor() {
        super("show titles", true)
    }
}

class TimeSetting extends Setting {
    constructor(name, defaultValue) {
        super(name, defaultValue)
    }

    async load(element) {
        await super.load(element)

        let label = this.createElement("label")
        label.innerHTML = this.name
        label.forName = this.getKey()

        let input = this.createElement("input")
        input.style.justifySelf = "right"
        input.type = "time"
        input.name = this.getKey()
        input.value = this.get()
        
        input.onchange = () => {
            this.persist(input.value)
            this.apply()
        }
    }

    apply() {
        super.apply()
    }
}

class DayStartSetting extends TimeSetting {
    constructor() {
        super("day start", "07:00")
    }
    apply() {
        super.apply()
    }
}

class DayEndSetting extends TimeSetting {
    constructor() {
        super("day end", "21:00")
    }
    apply() {
        super.apply()
    }
}

class ControlWithConfirmation extends Component {
    constructor(text, confirmation, timeout) {
        super()
        this.text = text
        this.confirmation = confirmation
        this.timeout = timeout
    }

    async load(element) {
        await super.load(element)

        let button = this.createElement("a")
        button.innerHTML = this.text

        let confirmationButton = this.createElement("a")
        confirmationButton.innerHTML = this.confirmation
        confirmationButton.classList.add(CLASS_HIGHLIGHTED)
        confirmationButton.style.display = "none"

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
    }
}

class ClearStorageControl extends ControlWithConfirmation {
    constructor() {
        super("Clear storage", "Click if you are sure you want to clear storage", 5000)
    }
    async load(element) {
        await super.load(element)
    }
    execute() {
        window.localStorage.clear()
        window.location.reload()
    }
}

function initStyleSettings() {
    // some settings must be initialized to configure page styles
    TextSizeSetting.factory()
    ThemeSliderSetting.factory()
    
    LightThemeBackgroundColorSetting.factory()
    LightThemeTextColorSetting.factory()
    LightThemeHighlightColorSetting.factory()
    LightThemeHighlightTextColorSetting.factory()
    LightThemeErrorColorSetting.factory()
    //LightThemeErrorTextColorSetting.factory()
    LightThemeSuccessColorSetting.factory()
    //LightThemeSuccessTextColorSetting.factory()

    DarkThemeBackgroundColorSetting.factory()
    DarkThemeTextColorSetting.factory()
    DarkThemeHighlightColorSetting.factory()
    DarkThemeHighlightTextColorSetting.factory()
    DarkThemeErrorColorSetting.factory()
    //DarkThemeErrorTextColorSetting.factory()
    DarkThemeSuccessColorSetting.factory()
    //DarkThemeSuccessTextColorSetting.factory()
}