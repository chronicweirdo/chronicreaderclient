## TODO

- find a way to release the chronicreaderlib library
- load released library into the current project
- (probably in the end the library will still be embedded here, but with a version)
- improve the chronicreaderlib with controls for setting font sizes, book styles
- chronicreaderlib configurable hooks (for example for updating progress on a backend)
- function to compute dominant color of image (current page in comic)
- extract cover in serviceworker
- find a way to integrate with a backend server - any backend server
- define a backend server API and connection, sync process (server should allow information about available books, available collections, existing progress and progress syncing)
- compute and use book file checksum as an id
- load books from the backend server
- sync progress to the backend server
- save (missing) books to the backend server
- implement new api-only backend
- implement extraction library for rar
- optional: implement extraction library for zip

- [x] compute book id and use that to retrieve the book from the database
- [x] extract book cover when uploading
- [x] display book covers on main page
- [x] save progress to database and use saved progress when loading the book
- [] integrate with a backend

## Setup

```
npm install -g bower
bower install crypto-js
```