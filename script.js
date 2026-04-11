import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, collection, onSnapshot, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

/* FIREBASE */
var firebaseConfig = {
  apiKey: "AIzaSyDowtDPpdQCM7R5sQoJv9lvHrDO7-WjBiE",
  authDomain: "bus-attendance-3d71d.firebaseapp.com",
  projectId: "bus-attendance-3d71d",
  storageBucket: "bus-attendance-3d71d.appspot.com",
  messagingSenderId: "651539926035",
  appId: "1:651539926035:web:b980197de105ce8359c3e6"
};

var app = initializeApp(firebaseConfig);
var db = getFirestore(app);
var auth = getAuth();

/* GLOBAL */
var cachedStudentLoc = null;
var isSubmitting = false;
var busWatchId = null;
var today = new Date().toISOString().split("T")[0];

/* MENU */
window.toggleMenu = function () {
  var sidebar = document.getElementById("navLinks");
  var overlay = document.querySelector(".overlay");

  if (sidebar) sidebar.classList.toggle("active");
  if (overlay) overlay.classList.toggle("active");
};

/* ================= SESSION ================= */
function getSession() {
  let s = localStorage.getItem("adminSession");
  return s ? JSON.parse(s) : null;
}

function isSessionValid(session) {
  if (!session) return false;
  return (Date.now() - session.time < 60 * 60 * 1000);
}

/* ================= PAGE LOAD ================= */
document.addEventListener("DOMContentLoaded", function () {

  let path = window.location.pathname;
  let session = getSession();

  updateDate();
setInterval(updateDate, 1000);

  if (session && session.bus) {
    localStorage.setItem("bus", session.bus);
  }

  // ONLY admin dashboard (fix)
  if (path.includes("dashboard.html")) {
    if (!isSessionValid(session) || !session || !session.bus) {
      localStorage.removeItem("adminSession");
      alert("Session expired. Login again.");
      window.location.href = "admin.html";
      return;
    }
    startBusTracking();
  }

  if (path.includes("admin.html")) {
    if (isSessionValid(session)) {
      window.location.href = "dashboard.html";
    }
  }

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(pos => {
      cachedStudentLoc = pos;
    });
  }

  loadStudentData();
});

/* ================= ADMIN LOGIN ================= */
window.adminLogin = async function () {

  var email = document.getElementById("adminUser").value;
  var password = document.getElementById("adminPass").value;
  var bus = document.getElementById("bus").value;

  if (!email || !password) return alert("Enter email & password!");
  if (!bus) return alert("Select bus!");

  try {
    await signInWithEmailAndPassword(auth, email, password);

    localStorage.setItem("adminSession", JSON.stringify({
      loggedIn: true,
      bus: bus,
      time: Date.now()
    }));

    localStorage.setItem("bus", bus);

    window.location.href = "dashboard.html";

  } catch (e) {
    alert(e.message);
  }
};

/* ================= BUS TRACK ================= */
function startBusTracking() {

  if (busWatchId !== null) return;

  let session = getSession();
  if (!session) return;

  let bus = session.bus;
  if (!bus) return;

  busWatchId = navigator.geolocation.watchPosition(async function (pos) {

    await setDoc(doc(db, "buses", bus), {
      lat: pos.coords.latitude,
      lon: pos.coords.longitude,
      active: true,
      time: new Date().toISOString()
    });

  });
}

/* ================= STUDENT ================= */
var form = document.getElementById("studentForm");

if (form) {
  form.addEventListener("submit", async function (e) {

    e.preventDefault();
    if (isSubmitting) return;
    isSubmitting = true;

    var name = document.getElementById("name").value;
    var regno = document.getElementById("regno").value.toUpperCase();
    var dept = document.getElementById("dept").value;
    var stop = document.getElementById("stop").value;
    var bus = document.getElementById("bus").value;

    try {

      var pos = cachedStudentLoc || await new Promise((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej)
      );

      if (!bus) throw new Error("Select bus!");

      var snap = await getDoc(doc(db, "buses", bus));
      if (!snap.exists() || snap.data().active === false) throw new Error("Bus not active");

      var busLoc = snap.data();

      var dist = getDistance(
        pos.coords.latitude,
        pos.coords.longitude,
        busLoc.lat,
        busLoc.lon
      );

      if (dist > 2) throw new Error("Not near bus");

      var ref = doc(db, "attendance", bus, today, regno);
      var existing = await getDoc(ref);

      if (existing.exists()) throw new Error("Already marked today");

      await setDoc(ref, {
        name, regno, dept, stop,
        time: new Date().toISOString()
      });

      localStorage.setItem("studentData", JSON.stringify({ name, regno, dept, stop }));

      alert("Attendance marked!");
      window.location.href = "index.html";

    } catch (e) {
      alert(e.message);
    }

    isSubmitting = false;
  });
}

/* ================= AUTO FILL ================= */
function loadStudentData() {
  let saved = localStorage.getItem("studentData");
  if (!saved) return;

  let d = JSON.parse(saved);

  ["name", "regno", "dept", "stop"].forEach(id => {
    if (document.getElementById(id)) {
      document.getElementById(id).value = d[id] || "";
    }
  });
}

/* ================= LIVE TABLE ================= */
let table = document.getElementById("tableBody");

if (table) {

  let bus = localStorage.getItem("bus");

  onSnapshot(collection(db, "attendance", bus, today), snap => {

  table.innerHTML = "";
  let index = 1;

  if (snap.empty) {
    table.innerHTML = `
      <tr>
        <td colspan="7" style="text-align:center; padding:20px;">
          No Data Available
        </td>
      </tr>
    `;
    return;
  }

  snap.forEach(docData => {

    let s = docData.data();
    let d = new Date(s.time);

    let row = document.createElement("tr");

    row.innerHTML = `
      <td>${index++}</td>
      <td>${s.name}</td>
      <td>${s.regno}</td>
      <td>${s.dept}</td>
      <td>${s.stop}</td>
      <td>${d.toLocaleDateString("en-IN")}</td>
      <td>${d.toLocaleTimeString("en-IN")}</td>
    `;

    table.appendChild(row);
  });

});
}

/* ================= LOGOUT ================= */
window.logout = async function () {

  let bus = localStorage.getItem("bus");

  if (bus) {
    await setDoc(doc(db, "buses", bus), { active: false }, { merge: true });
  }

  if (busWatchId !== null) {
    navigator.geolocation.clearWatch(busWatchId);
  }

  localStorage.clear();
  window.location.href = "index.html";
};

/* ================= DISTANCE ================= */
function getDistance(lat1, lon1, lat2, lon2) {

  var R = 6371;
  var dLat = (lat2 - lat1) * Math.PI / 180;
  var dLon = (lon2 - lon1) * Math.PI / 180;

  var a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/* ================= MAIN DASHBOARD (ALL BUS) ================= */

window.loadMainData = async function (event) {

  let btn = event.target;
  btn.innerText = "Loading...";
  btn.disabled = true;

  let selectedBus = document.getElementById("mainBus").value;
  let table = document.getElementById("mainTable");

  table.innerHTML = "";
  let index = 1;

  let allData = [];

  // 🔥 CASE 1: ALL BUSES
  if (selectedBus === "all") {

    for (let i = 1; i <= 51; i++) {

      let bus = "bus" + i;
      let snap = await getDocs(collection(db, "attendance", bus, today));

      snap.forEach(docData => {
        let s = docData.data();
        allData.push({
          bus,
          ...s
        });
      });
    }

  } 
  // 🔥 CASE 2: SINGLE BUS
  else {

    let snap = await getDocs(collection(db, "attendance", selectedBus, today));

    snap.forEach(docData => {
      let s = docData.data();
      allData.push({
        bus: selectedBus,
        ...s
      });
    });
  }

  // ✅ SORT BY BUS NUMBER (IMPORTANT)
  allData.sort((a, b) => {
    let numA = parseInt(a.bus.replace("bus", ""));
    let numB = parseInt(b.bus.replace("bus", ""));
    return numA - numB;
  });

  // ✅ RENDER TABLE
  allData.forEach(data => {

    let d = new Date(data.time);

    let row = document.createElement("tr");

    row.innerHTML = `
      <td>${index++}</td>
      <td>${getBusName(data.bus)}</td>
      <td>${data.name}</td>
      <td>${data.regno}</td>
      <td>${data.dept}</td>
      <td>${data.stop}</td>
      <td>${d.toLocaleDateString("en-IN")}</td>
      <td>${d.toLocaleTimeString("en-IN")}</td>
    `;

    table.appendChild(row);
  });

  btn.innerText = "Load Data";
  btn.disabled = false;
};

/* ================= ALL BUS PDF ================= */
window.downloadMainPDF = function () {

  const { jsPDF } = window.jspdf;
  let doc = new jsPDF();

  let selectedBus = document.getElementById("mainBus").value;
  let table = document.getElementById("mainTable");
  let rows = table.querySelectorAll("tr");

  let body = [];
  let lastBus = "";

  rows.forEach(row => {
    let cols = row.querySelectorAll("td");

    if (cols.length) {
      let currentBus = cols[1].innerText;

      // 🔥 ADD BUS TITLE ROW
      if (currentBus !== lastBus) {
        body.push([
          `--- ${currentBus} ---`, "", "", "", "", "", "", ""
        ]);
        lastBus = currentBus;
      }

      let rowData = [];
      cols.forEach(col => rowData.push(col.innerText));
      body.push(rowData);
    }
  });

  doc.text(`Attendance Report - ${today}`, 14, 10);

  doc.autoTable({
    head: [["S.no","Bus","Name","Reg No","Dept","Stop","Date","Time"]],
    body: body,
    startY: 20
  });

  doc.save(`ALL_BUSES_${today}.pdf`);
};
/* ================= ALL BUS CSV ================= */
window.downloadMainCSV = function () {

  let table = document.getElementById("mainTable");
  let rows = table.querySelectorAll("tr");

  let csv = [];

  rows.forEach(row => {
    let cols = row.querySelectorAll("td, th");
    let rowData = [];

    cols.forEach(col => {
      rowData.push('"' + col.innerText + '"');
    });

    csv.push(rowData.join(","));
  });

  let blob = new Blob([csv.join("\n")], { type: "text/csv" });
  let url = window.URL.createObjectURL(blob);

  let a = document.createElement("a");
  a.href = url;
  a.download = `ALL_BUS_attendance_${today}.csv`;
  a.click();
};

/* ================= SECURITY ================= */
if (window.location.pathname.includes("manager")) {
  let email = prompt("Enter Manager Email:");

  if (email !== "parthak200701@gmail.com") {
    alert("Access denied");
    window.location.href = "index.html";
  }
}

function getBusName(bus) {
  const map = {
        bus1:"	R-01	Ennore",
    bus2:"	R-01A	Tondiarpet",
    bus3:"	R-01B	Kasimedu",
    bus4:" R-02	Triplicane",
    bus5:" R-03	Choolai",
    bus6:" R-03A	Collector Nagar",
    bus7:"	R-03B	Water Tank",
    bus8:"	R-04	East Mogappair",
    bus9:"	R-05	CIT Nagar",
    bus10:"R-05A	Loyola College",
    bus11:"R-06	Chinmayanagar",
    bus12:"R-07	Santhome",
    bus13:"R-08	Kovilambakkam",
    bus14:"R-08A	Adambakkam",
    bus15:"R-09	MKB Nagar",
    bus16:"R-09A	Perambur",
    bus17:"R-10	Thachoor",
    bus18:"R-11	Chengalpattu",
    bus19:"R-11A	Guduvanchery",
    bus20:"R-12	Minjur",
    bus21:"R-13	Vyasarpadi",
    bus22:"R-13A	ICF",
    bus23:"R-14	Thiruvallur",
    bus24:"R-14A	Kakkalur",
    bus25:"R-15	Kancheepuram",
    bus26:"R-15A	Orikkai",
    bus27:"R-16	Neelangkarai",
    bus28:"R-16A	Guindy",
    bus29:"R-16B	Sholinganallur",
    bus30:"R-17	Valluvarkottam",
    bus31:"R-17A	Valasaravakkam",
    bus32:"R-18	Pallikaranai",
    bus33:"R-18A	Sembakkam",
    bus34:"R-18B	Kelambakkam",
    bus35:"R-19	Poombukar",
    bus36:"R-19A	Vinayagapuram",
    bus37:"R-20	Vepampattu",
    bus38:"R-21	Ayyapakkam",
    bus39:"R-22	Thiruthani",
    bus40:"R-22A	SR Gate",
    bus41:"R-23	K4 Police Station",
    bus42:"R-24	Arcot",
    bus43:"R-25	Kallikuppam",
    bus44:"R-25A	Pudur",
    bus45:"R-26	Andarkuppam",
    bus46:"R-27	Avadi",
    bus47:"R-27A	Kollumedu",
    bus48:"R-28	Agaram",
    bus49:"R-29	Velachery",
    bus50:"R-29A	Pammal",
    bus51:"R-29B	Sivanthangal"
  
  };

  return map[bus] || bus;
}
window.loadBusData = async function (event) {

  let bus = document.getElementById("managerBus").value;
  let table = document.getElementById("managerTable");

  if (!bus) {
    alert("Select a bus!");
    return;
  }

  table.innerHTML = "";
  let index = 1;

  let snap = await getDocs(collection(db, "attendance", bus, today));

  snap.forEach(docData => {

    let s = docData.data();
    let d = new Date(s.time);

    let row = document.createElement("tr");

    row.innerHTML = `
      <td>${index++}</td>
      <td>${s.name}</td>
      <td>${s.regno}</td>
      <td>${s.dept}</td>
      <td>${s.stop}</td>
      <td>${d.toLocaleDateString("en-IN")}</td>
      <td>${d.toLocaleTimeString("en-IN")}</td>
    `;

    table.appendChild(row);

   
  });

   if (table.innerHTML === "") {
  table.innerHTML = `
    <tr>
      <td colspan="7" style="text-align:center; padding:20px;">
        No Data Available
      </td>
    </tr>
  `;
}

};

window.downloadManagerPDF = function () {

  const { jsPDF } = window.jspdf;
  let doc = new jsPDF();

  let bus = document.getElementById("managerBus").value;

  if (!bus) {
    alert("Select a bus!");
    return;
  }

  let table = document.getElementById("managerTable");
  let rows = table.querySelectorAll("tr");

  let body = [];

  rows.forEach(row => {
    let cols = row.querySelectorAll("td");
    let rowData = [];

    cols.forEach(col => {
      rowData.push(col.innerText);
    });

    if (rowData.length) body.push(rowData);
  });

  let busName = getBusName(bus);

  // 🔥 TITLE
  doc.text(`${busName} Attendance Report - ${today}`, 14, 10);

  // 🔥 TABLE
  doc.autoTable({
    head: [[
      "S.no", "Name", "Reg No", "Dept", "Stop", "Date", "Time"
    ]],
    body: body,
    startY: 20
  });

  // 🔥 FILE NAME (clean)
  let fileName = busName
    .replace(/\s+/g, "_")
    .replace(/[^\w]/g, "");

  doc.save(`${fileName}_attendance_${today}.pdf`);
};

function updateDate() {

  let el = document.getElementById("liveDate");
  if (!el) return;

  let now = new Date();

  let date = now.toLocaleDateString("en-IN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric"
  });

  let time = now.toLocaleTimeString("en-IN");

  el.innerText = `${date} | ${time}`;
}

window.downloadData = function () {

  let table = document.getElementById("tableBody");
  let rows = table.querySelectorAll("tr");

  let csv = [];

  // HEADER
  csv.push('"S.no","Name","Reg No","Dept","Stop","Date","Time"');

  rows.forEach(row => {
    let cols = row.querySelectorAll("td");
    let rowData = [];

    cols.forEach(col => {
      rowData.push('"' + col.innerText + '"');
    });

    if (rowData.length) csv.push(rowData.join(","));
  });

  let blob = new Blob([csv.join("\n")], { type: "text/csv" });
  let url = window.URL.createObjectURL(blob);

  let a = document.createElement("a");
  a.href = url;

  let bus = getBusName(localStorage.getItem("bus") || "bus");
  let date = new Date().toISOString().split("T")[0];

  a.download = `${bus.replace(/\s+/g,"_")}_attendance_${date}.csv`;
  a.click();
};

window.downloadPDF = function () {

  const { jsPDF } = window.jspdf;
  let doc = new jsPDF();

  let table = document.getElementById("tableBody");
  let rows = table.querySelectorAll("tr");

  let body = [];

  rows.forEach(row => {
    let cols = row.querySelectorAll("td");
    let rowData = [];

    cols.forEach(col => {
      rowData.push(col.innerText);
    });

    if (rowData.length) body.push(rowData);
  });

  let bus = getBusName(localStorage.getItem("bus") || "bus");
  let date = new Date().toISOString().split("T")[0];

  doc.text(`${bus} Attendance Report - ${date}`, 14, 10);

  doc.autoTable({
    head: [["S.no","Name","Reg No","Dept","Stop","Date","Time"]],
    body: body,
    startY: 20
  });

  doc.save(`${bus.replace(/\s+/g,"_")}_attendance_${date}.pdf`);
};

window.printTable = function () {

  let table = document.querySelector(".table-container").innerHTML;

  let bus = getBusName(localStorage.getItem("bus") || "bus");
  let date = new Date().toLocaleDateString("en-IN");

  let newWin = window.open("", "", "width=900,height=700");

  newWin.document.write(`
    <html>
    <head>
      <title>Print Attendance</title>
      <style>
        body { font-family: Arial; padding: 20px; }
        h2 { text-align: center; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid black; padding: 8px; }
        th { background: #eee; }
      </style>
    </head>
    <body>

      <h2>${bus} Attendance Report</h2>
      <p style="text-align:center;">${date}</p>

      ${table}

    </body>
    </html>
  `);

  newWin.document.close();
  newWin.print();
};

