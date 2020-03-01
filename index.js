const fetch = require('node-fetch')
const SocksProxyAgent = require('socks-proxy-agent')
const sqlite3 = require('sqlite3').verbose()
const {
    JSDOM
} = require('jsdom')

const proxy = 'socks5h://127.0.0.1:9050'
const agent = new SocksProxyAgent(proxy)

const init = {
    agent
}

const URL_REGEXP = /(https?:\/\/[\w]+\.onion)/g

let db = null
let dbURLs = []

function migrate() {
    db.exec(`
        CREATE TABLE urls(
            name CHAR(64) PRIMARY KEY NOT NULL,
            title CHAR(64),
            alive INT
            );
    `)
    db.exec(`INSERT INTO urls VALUES('https://facebookcorewwwi.onion', '', 0)`)
}

function findLinks(url, index) {
    console.log(`[${index + 1}/${dbURLs.length + 1}] Searching in "${url}"...`)

    return fetch(url, init)
        .then(result => result.text())
        .then(result => {
            console.log(`"${url}" is alive.`)
            const dom = new JSDOM(result)

            const title = dom.window.document.querySelector('title').innerHTML.replace("'", "''").trim()

            db.exec(`UPDATE urls SET alive = 1 WHERE name = '${url}'`)
            db.exec(`UPDATE urls SET title = '${title}' WHERE name = '${url}'`)
            const matches = result.match(URL_REGEXP)
            if (!matches) {
                return
            }
            matches.forEach(url => {
                if (!dbURLs.includes(url)) {
                    db.exec(`INSERT INTO urls VALUES ('${url}', '', 0)`)
                    dbURLs.push(url)
                    console.log(`Found link to "${url}" in "${title}"!`)
                }
            })
        })
        .catch(e => {
            console.warn(e.message)
        })
}

async function crawl() {
    db = new sqlite3.Database('./index.db')
    // migrate()

    db.all('SELECT * FROM urls', async (err, rows) => {
        dbURLs = rows.map(record => record.name)
        for (let i = 0; i < dbURLs.length; i++) {
            await findLinks(dbURLs[i], i)
        }
        db.once('SELECT COUNT(*) FROM urls', (err, result) => {
            console.log(`Number of URLs in database now is ${result}.`)
        })
        db.close()
    })
}

crawl()