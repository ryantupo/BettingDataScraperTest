// Add stealth plugin and use defaults (all evasion techniques)
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const Puppeteer = require('puppeteer-extra');
const AdblockerPlugin = require('puppeteer-extra-plugin-adblocker');
const Mysql = require('mysql');
require('dotenv').config({ path: '.env' });

// Speeds up rendering of page.
Puppeteer.use(StealthPlugin());
Puppeteer.use(AdblockerPlugin({
    blockTrackers: true
}));

(async () => {

    function createDbTable(connection) {
        //creation SQL
        const sql = 'CREATE TABLE IF NOT EXISTS `betway_games` ( `id` int(11) NOT NULL AUTO_INCREMENT, `first_team` varchar(255) NOT NULL, `second_team` varchar(255) NOT NULL,  `first_win_odd` decimal(10, 2) NOT NULL,  `draw_odd` decimal(10, 2) NOT NULL, `second_win_odd` decimal(10, 2) NOT NULL, `time_of_event` varchar(255) NOT NULL,`created_at` timestamp NOT NULL DEFAULT current_timestamp(),PRIMARY KEY(`id`)) ENGINE = InnoDB DEFAULT CHARSET = latin1';

        connection.query(sql, err => {
            if (err) {
                console.log(err);
                return false;
            } else {
                return true;
            }
        });
    }

    function dbCreation_Insert(inserts, connection) {

        connection.query('INSERT INTO betway_games(first_team, second_team, time_of_event, first_win_odd, draw_odd, second_win_odd) VALUES ? ', [inserts], (err, results, fields) => {

            if (err) {
                console.log(err);
            } else {
                console.log('Insertion worked');
            }
        });
    }

    const browser = await Puppeteer.launch({
        headless: false,
        slowMo: 50,
        devtools: false,
        waitUntil: 'networkidle0',
    });

    const con = Mysql.createPool({
        connectionLimit: 1000,
        host: process.env.MYSQL_HOST,
        user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASSWORD,
        database: process.env.MYSQL_DATABASE
    });

    const page = await browser.newPage();
    await page.goto('https://betway.com/en/sports/cat/ice-hockey');
    await page.waitForTimeout(4000);

    let events = await page.$$eval(".eventHolder",
        elements => elements.map(item => item.textContent))

    const cleanedData = events.map(cleanedItem => {
        return cleanedItem.replace("More BetsSuspendedMore", "").replace("●", "").replace(",", "").replace("●", "").replace("  ", " ").replace("  @ ", "-").replace("  V ", "-");
    })

    let inserts = [];

    con.getConnection((err, connection) => {
        //create table if not exist
        createDbTable(connection);

        if (err) {
            console.log(err);
        } else {

            for (const item of cleanedData) {

                let currentInsert = [];

                let timeOfGame = item.slice(0, 5);

                //team names
                let teamNames = item.slice(5, -16).trim().split("-");
                let first_team_name = teamNames[0];
                let second_team_name = teamNames[1];

                //odds extracted
                let oddObject = item.slice(-16).substring(4);
                let away_winning_odds = oddObject.substring(0, 4);
                let draw_winning_odds = oddObject.substring(4, 8);
                let home_winning_odds = oddObject.substring(8, 12);

                currentInsert.push(first_team_name, second_team_name, timeOfGame, away_winning_odds, draw_winning_odds, home_winning_odds);
                inserts.push(currentInsert);

            }
            //ruuning of sql
            dbCreation_Insert(inserts, connection);
        }
    });

    await browser.close();
    console.log('End of Mining...');
    process.exit(1);
})();
