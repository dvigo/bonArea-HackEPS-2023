const canvas = document.getElementById('supermarket');
const ctxIconCustomer = canvas.getContext('2d');
const ctxIconCollition = canvas.getContext('2d');
const ctxSquare = canvas.getContext("2d");

const img = new Image();
img.src = "img/marker_client.png";
const imgCollition = new Image();
imgCollition.src = "img/red_alert.svg";

const DIM = 40;

const states = [
    '⚪&nbsp;&nbsp;Pendiente',
    '🔴&nbsp;&nbsp;En espera',
    '🔵&nbsp;&nbsp;En ruta',
    '🟢&nbsp;&nbsp;Completado'
];

let tickets;
let customerColor = new Map();
let customerTickets = new Map();
let locationsShared;
let locationsCollition;
let locationsTotal = [];

let speedText = 1; // es podria multiplicar per 1000, 100, 10 o 1.
let speedValue = 1000;
let cw = canvas.width = container.offsetWidth;
let ch = canvas.height = container.offsetHeight;

let lastPick = [];
let currentTime = 0;

function until(conditionFunction) {

    const poll = resolve => {
      if(conditionFunction()) resolve();
      else setTimeout(_ => poll(resolve), 10);
    }
  
    return new Promise(poll);
}

document.getElementById('filePicker').addEventListener('change', readFile, false);
document.getElementById('speed_text').innerHTML = "Velocidad Actual: " + speedText;

const planogramFile = 'http://127.0.0.1:8000/data/planogram_table.csv';
const ticketsFile = 'http://127.0.0.1:8000/data/hackathon_tickets.csv';
let csvData = null;
let ticketsTableData = null;
let tableData = [];

importCSVData(planogramFile).then(data => { csvData = data; });
importCSVData(ticketsFile).then(data => { ticketsTableData = data; createTable();});

/**
 * Read CSV file 
 * @param e file content
 */
function readFile(e) {
    tickets = new Map();
    var file = e.target.files[0];
    if (!file) {
        return;
    }
    var reader = new FileReader();
    reader.onload = function (e) {
        var data = e.target.result;
        getDataOfFile(data);
    };
    reader.readAsText(file);
}
/**
 * Get content of the CSV file, line by line, splitting it by semicolon.
 * @param contents Content of the file
 */
function getDataOfFile(contents) {
    const dataCSV = [];
    const breakLine = contents.split("\n");
    const shopOpeningTime = caculateOpenDate(breakLine);

    for (let i = 1; i < breakLine.length; i++) {
        let [customer_id, ticket_id, x, y, picking, x_y_date_time] = breakLine[i].split(';');
        var index = dataCSV.findIndex((element) => element[0] === customer_id);
        if (index === -1) {
            const sec = epochConverter(x_y_date_time, shopOpeningTime);
            if (tickets.has(ticket_id)) {
                const locationsList = tickets.get(ticket_id);
                locationsList.push({ x, y, sec, ticket_id, picking });
                tickets.set(ticket_id, locationsList);
            }
            else { tickets.set(ticket_id, [{ x, y, sec, ticket_id, picking }]); }
            if(ticket_id)locationsTotal.push({ x: x, y: y, s: sec, t: ticket_id });
        }
        setState(ticket_id, 1);

    }
    updateDataTable();
    getSharedAndCollitionLocations();
    calculateFirstcustomerSec();
    updateTime();
}

/**
 * Generates an object with locations and time of the CSV file
 * @param locations customer list of locations points 
 * @return waypoints - object of locations and time
 */
function calcWaypoints(locations) {
    var waypoints = [];
    var time = locations[0].sec;
    for (var i = 0; i < locations.length; i++) {
        var pt = locations[i];
        var dx = (pt.x - 1) * DIM;
        var dy = (pt.y - 1) * DIM;
        waypoints.push({ x: dx, y: dy, s: pt.sec, t: (time + i), picking: pt.picking, ticket_id: pt.ticket_id});
    }
    return (waypoints);
}

/**
 *Calculates the first second of each ticket.
 */
async function calculateFirstcustomerSec() {
    for (let [key, value] of tickets) {
        const color = generateColor();
        customerTickets.set(color, key)
        customerColor.set(key, color)
        value = sortRouteByTime(value);
        tickets.set(key, value);
        const firstSecond = (+value[0].sec);
        const lastSecond = (+value[value.length - 1].sec);
        const duration = lastSecond - firstSecond;
        setDuration(key, duration);
    }
    updateDataTable();
    for (let [key, value] of tickets) {
        const color = customerColor.get(key);
        let firstSecond = (+value[0].sec);
        const locations = calcWaypoints(value);
        await drawRouteAfterSeconds(locations, firstSecond, color);
    }
}
/**
 * Execute drawRoute function after first second given by calculateFirstcustomerSec function
 * @param locations customer list of locations points 
 * @param firstSecond customer first second
 * @param color HEX color value
 */
async function drawRouteAfterSeconds(locations, firstSecond, color) {
    console.log(currentTime);
    console.log(firstSecond);
    await until(() => { return currentTime >= firstSecond; });
    console.log(currentTime >= firstSecond);
    drawRoute(locations, color);
}

/**
 * Draw the customers route, with its image, and the color assigned to it. 
 * @param locationRoute customer list of locations points 
 * @param color HEX color value
 */
async function drawRoute(locationRoute, color) {
    const locRoute = locationRoute;
    let collition = false
    for (let point of locRoute) {
        drawSquare(point.x, point.y, hexToRGB(color, 0.02));
    }
    setState(locationRoute[0].ticket_id, 2);
    for (let point of locRoute) {
        for (let loc of locationsCollition) {
            const x = ((+loc.split('U')[0]) - 1) * DIM
            const y = ((+loc.split('U')[1]) - 1) * DIM
            const s = ((+loc.split('U')[2]))
            if (point.s == s && point.x == x && point.y == y) {
                drawSquare(point.x, point.y, color);
                await until(() => { return currentTime >= point.s; });
                drawLocationsCollition(x, y)
                collition = true
                continue
            }
        }
        if (!collition) {
            if (point.s != point.t) {
                clearRoute(locRoute);
                return;
            }
            
            cleanLastPick(color);
            if (point.picking == '1') pick(point.x, point.y, color);
            ctxIconCustomer.drawImage(img, point.x, point.y, DIM, DIM);

            await until(() => { return currentTime >= point.s; });
            drawSquare(point.x, point.y, color);

        } collition = false
    }
    await sleep((speedValue / 2));
    clearRoute(locRoute, color);
    setState(locationRoute[0].ticket_id, 3);

}

/**
 * Deletes the points of the route, when the customer leaves the store 
 * @param locationRoute customer list of locations points 
 * @param color HEX color value
 * @return returns
 */
function clearRoute(locationRoute, color) {
    for (let point of locationRoute) { ctxSquare.clearRect(point.x, point.y, DIM, DIM); }
    const lastLocation = locationRoute[locationRoute.length - 1]
    const colorTicket = customerTickets.get(color);
    for (let [key, value] of locationsShared) {
        if (value.length == 0) continue
        value.delete(colorTicket);
        locationsShared.set(key, value);

    }
    for (let [key, value] of locationsShared) {
        for (let ticket of value) {
            if (lastLocation.s > (+key.split('U')[2])) {
                drawSquare(((+key.split('U')[0]) - 1) * DIM, ((+key.split('U')[1]) - 1) * DIM, customerColor.get(ticket));
            }
        }
    }
    for (let loc of locationsCollition) {
        if (lastLocation.s > (+loc.split('U')[2])) {
            drawLocationsCollition(((+loc.split('U')[0]) - 1) * DIM, ((+loc.split('U')[1]) - 1) * DIM);
        }
    }

}


/**
 * Function for draw square with specific color
 * @param x x location 
 * @param y y location
 * @param color HEX color value
 */
function drawSquare(x, y, color, shadow = false) {
    ctxSquare.lineCap = 'square';

    if (shadow) {
        // Create a slightly tinted color by adjusting the alpha value
        color = hexToRGBA(color, 0.7); // 0.7 is the alpha value, adjust as needed for the tint effect
    }
    ctxSquare.fillStyle = color;
    ctxSquare.fillRect(x, y, DIM, DIM);
}

// Helper function to convert hex color to RGBA
function hexToRGBA(hex, alpha) {
    let r = parseInt(hex.slice(1, 3), 16);
    let g = parseInt(hex.slice(3, 5), 16);
    let b = parseInt(hex.slice(5, 7), 16);

    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Generates a new different color.
 * @return randomColor
 */
function generateColor() {
    let maxVal = 0xFFFFFF;
    let randomColor;
    do {
        randomColor = Math.floor(Math.random() * maxVal);
    } while (randomColor === 0xFFFFFF);
    let randColor = randomColor.toString(16).padStart(6, "0");
    return `#${randColor.toUpperCase()}`
}
/**
 * Waits ms seconds
 * @param ms miliseconds
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
/**
 * Function called from html buttons, that modifies the speed of the route. 
 * Also modifies the text shown between the buttons. 
 * @param buttonAction passing add or remove depending on which button is clicked. 
 */
function modifySpeed(buttonAction) {
    
    if (buttonAction == 'add' && speedText < 4) {         
        speedText = speedText + 1;
        speedValue = speedValue/10 ;
    } else if(buttonAction=='remove' && speedText >1) {
        speedText = speedText - 1;
        speedValue = speedValue*10; 
    }
    document.getElementById('speed_text').innerHTML = "Velocitat Actual: " + speedText;
}


/**
 *Converts date and time from the CSV file to epoctime and returns milliseconds.
 * @param date day and time format like "yyyy-mm-dd hh:mm:ss"
 * @param shopOpeningTime epochtime of the shop open time.
 * @return milliseconds
 */
function epochConverter(date, shopOpeningTime) {
    var epochtime = Date.parse(date);
    return ((epochtime - shopOpeningTime) / 1000);
}

/**
 * Sort arrayValues by time and returns it.
 * @param arrayValues array of locations and time
 * @return arrayValues
 */
function sortRouteByTime(arrayValues) {
    for (var i = 0; i < arrayValues.length; i++) {
        for (var j = i + 1; j < arrayValues.length; j++) {
            if (arrayValues[i].sec > arrayValues[j].sec) {
                let lineValueAux = arrayValues[i];
                arrayValues[i] = arrayValues[j];
                arrayValues[j] = lineValueAux;
            }
        }
    }
    return (arrayValues);
}

/**
 * Read the date (day) of the breakLine, set the time to 9:00 and returns it in epochtime.
 * @param breakLine line from CSV file
 * @return epochtime of the shop opening time
 */
function caculateOpenDate(breakLine) {
    let [a, b, c, d, e, date] = breakLine[1].split(';');
    let datestr = date.substring(0, 10);
    let timestr = "09:00:00";
    datestr = datestr.concat(" ", timestr);
    return Date.parse(datestr);
}
/**
 * Function that draws all the collitions.
 */
function drawLocationsCollition(x, y) {
    ctxIconCollition.drawImage(imgCollition, x, y, DIM, DIM);
}
/**
 * Function to set a Shared locations list 
 * and collition location list.
 */
function getSharedAndCollitionLocations() {
    locationsShared = new Map();
    locationsCollition = [];
    locationsTotal.forEach((element, index) => {
        locationsTotal.forEach((loc, i) => {
            if (element.x == loc.x && element.y == loc.y && i != index) {
                const idList = loc.x.concat('U').concat(loc.y).concat('U').concat(loc.s);
                if (element.s == loc.s) {
                    if (locationsCollition.indexOf(idList) == -1) locationsCollition.push(idList)
                }
                if (element.t != loc.t) {
                    if (locationsShared.has(idList)) {
                        const newList = locationsShared.get(idList);
                        newList.add(loc.t);
                    }
                    else { locationsShared.set(idList, new Set([loc.t])); }
                }

            }
        });
    });
}

// Function to import CSV data
function importCSVData(route) {
    return fetch(route)
    .then(response => response.text())
    .then(data => {
      return csvJSON(data);
    });
  }


function pick(x, y, color) {
    x = (x / DIM) + 1;
    y = (y / DIM) + 1;
    let row = csvData.filter((row) => {
        return row.picking_x == x && row.picking_y == y;
    });
    
    var dx = (row[0].x - 1) * DIM;
    var dy = (row[0].y - 1) * DIM;
    lastPick[color] = [dx, dy];
    drawSquare(dx, dy, color, true);
}

function csvJSON(csv) {
    const lines = csv.split('\r\n')
    const result = []
    const headers = lines[0].split(';')

    for (let i = 1; i < lines.length; i++) {
        if (!lines[i])
            continue
        const obj = {}
        const currentline = lines[i].split(';')

        for (let j = 0; j < headers.length; j++) {
            obj[headers[j]] = currentline[j]
        }
        result.push(obj)
    }
    return result
}

function cleanLastPick(color) {
    if (color in lastPick && lastPick[color].length > 0) {
        ctxSquare.clearRect(lastPick[color][0], lastPick[color][1], DIM, DIM);
        lastPick[color] = [];
    }
}

function hexToRGB(hex, alpha) {
    var r = parseInt(hex.slice(1, 3), 16),
        g = parseInt(hex.slice(3, 5), 16),
        b = parseInt(hex.slice(5, 7), 16);

    if (alpha) {
        return "rgba(" + r + ", " + g + ", " + b + ", " + alpha + ")";
    } else {
        return "rgb(" + r + ", " + g + ", " + b + ")";
    }
}

async function updateTime() {
    let id = "current-time";
    let element = document.getElementById(id);
    let d = new Date(0);
    d.setHours(9 + 1); // +1 due to timezone
    d.setMinutes(0);
    d.setSeconds(0);
    Date.prototype.addSeconds = function(s) {
        this.setSeconds(this.getSeconds() + s);
        return this;
    };

    for(let i = 0; i < Infinity; i++) {
        currentTime += 1;
        d.addSeconds(1);
        element.innerHTML = "Tiempo actual: " + currentTime + " - " + d.toISOString().substr(11, 8);
        
        await sleep(speedValue);
    }
}

function createTable() {
    for (let ticket in ticketsTableData) {
        let oldTicket = tableData.filter((row) => {
            return row.ticketsNre == ticketsTableData[ticket].ticket_id;
        });
        if (oldTicket.length > 0) {
            oldTicket[0].productNre += parseInt(ticketsTableData[ticket].quantity);
            continue;
        }
        tableData.push({
            state: states[0],
            customer: ticketsTableData[ticket].customer_id,
            start: ticketsTableData[ticket].enter_date_time,
            finish: ' --- ',
            duration: ' --- ',
            ticketsNre: ticketsTableData[ticket].ticket_id,
            productNre: parseInt(ticketsTableData[ticket].quantity)
        });
    }

    setDataTable(tableData);
}

function setState(ticket_id, state) {
    for( let i = 0; i < tableData.length; i++){
        if ( tableData[i].ticketsNre === ticket_id) {
            tableData[i].state = states[state];
            break;
        }
    }
}

function setDuration(ticket_id, time) {
    for( let i = 0; i < tableData.length; i++){
        if ( tableData[i].ticketsNre === ticket_id) {
            tableData[i].duration = convertSecondsToMinutesAndSeconds(time);
            let exit = new Date(tableData[i].start);
            exit.setSeconds(exit.getSeconds() + time);
            tableData[i].finish = formatDateToCustomString(exit);
            break;
        }
    }
}

function updateDataTable() {
    setDataTable(tableData);
}

function setDataTable(tableData) {
    customElements.whenDefined('random-data-table').then(() => {
        const dataTable = document.querySelector('random-data-table');
        dataTable.setData(tableData);
    });
}

function formatDateToCustomString(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
  
    const formattedString = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    return formattedString;
}

function convertSecondsToMinutesAndSeconds(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes} min. ${remainingSeconds}s`;
  }