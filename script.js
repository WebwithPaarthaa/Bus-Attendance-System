import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, collection, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
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

/* LOAD */
document.addEventListener("DOMContentLoaded", function () {
var path = window.location.pathname;



  // 🔥 SESSION CHECK + 1 HOUR EXPIRY
  var session = localStorage.getItem("adminSession");

  if (session) {
    session = JSON.parse(session);

    var oneHour = 60 * 60 * 1000; // 1 hour

    if (Date.now() - session.time > oneHour) {
      localStorage.removeItem("adminSession");
      alert("Session expired. Please login again.");
      window.location.href = "admin.html";
      return;
    }
  }

  var path = window.location.pathname;

// preload location
if (navigator.geolocation) {
navigator.geolocation.getCurrentPosition(function (pos) {
cachedStudentLoc = pos;
});
}

// load saved student data
loadStudentData();

// admin protection
if (path.indexOf("dashboard.html") !== -1) {
var session = localStorage.getItem("adminSession");

if (!session) {
  window.location.href = "admin.html";
  return;
}

session = JSON.parse(session);

var oneHour = 60 * 60 * 1000;

if (Date.now() - session.time > oneHour) {
  localStorage.removeItem("adminSession");
  alert("Session expired. Please login again.");
  window.location.href = "admin.html";
  return;
}
startBusTracking();
}
});

/* ================= ADMIN LOGIN ================= */
window.adminLogin = async function () {
var email = document.getElementById("adminUser").value;
var password = document.getElementById("adminPass").value;
var bus = document.getElementById("adminBus").value;

if (!email || !password) {
alert("Enter email & password!");
return;
}

if (!bus) {
alert("Select bus!");
return;
}

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

/* ================= BUS TRACKING ================= */
function startBusTracking() {
var session = JSON.parse(localStorage.getItem("adminSession"));
var bus = session.bus;
if (!bus) return;

busWatchId = navigator.geolocation.watchPosition(async function (pos) {
var lat = pos.coords.latitude;
var lon = pos.coords.longitude;


await setDoc(doc(db, "buses", bus), {
  lat: lat,
  lon: lon,
  active: true,
  time: new Date().toISOString()
});


});
}

/* ================= STUDENT FORM ================= */
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
  var pos = cachedStudentLoc;

  if (!pos) {
    pos = await new Promise(function (res, rej) {
      navigator.geolocation.getCurrentPosition(res, rej);
    });
  }

  var snap = await getDoc(doc(db, "buses", bus));

  if (!snap.exists() || snap.data().active === false) {
    throw new Error("Bus not active");
  }

  var busLoc = snap.data();

  var dist = getDistance(
    pos.coords.latitude,
    pos.coords.longitude,
    busLoc.lat,
    busLoc.lon
  );

  if (dist > 2) {
    throw new Error("Not near bus");
  }

  var ref = doc(db, "attendance", bus, today, regno);
  var existing = await getDoc(ref);

  if (existing.exists()) {
    throw new Error("Already marked today");
  }
  
  await setDoc(ref, {
    name: name,
    regno: regno,
    dept: dept,
    stop: stop,
    time: new Date().toISOString()
  });

  // save for autofill
  localStorage.setItem("studentData", JSON.stringify({
    name: name,
    regno: regno,
    dept: dept,
    stop: stop
  }));

  alert("Attendance marked!");

  // 🔥 FORCE REDIRECT
  window.location.href = "index.html";

} catch (e) {
  alert(e.message);
}

isSubmitting = false;


});
}

/* ================= AUTO FILL ================= */
function loadStudentData() {
var saved = localStorage.getItem("studentData");
if (!saved) return;

var data = JSON.parse(saved);

if (document.getElementById("name")) {
document.getElementById("name").value = data.name || "";
document.getElementById("regno").value = data.regno || "";
document.getElementById("dept").value = data.dept || "";
document.getElementById("stop").value = data.stop || "";
}
}

/* ================= DASHBOARD ================= */
var table = document.getElementById("tableBody");

if (table) {
  var bus = localStorage.getItem("bus");

  onSnapshot(collection(db, "attendance", bus, today), function (snap) {
    table.innerHTML = "";
    let docs = [];
    let index = 1;

    snap.forEach(docData => {
      docs.push(docData.data());
    });

    // SORT BY TIME (EARLIEST FIRST)
    docs.sort((a, b) => new Date(a.time) - new Date(b.time));

    docs.forEach((s) => {
      let dateObj = new Date(s.time);

      let date = dateObj.toLocaleDateString();
      let time = dateObj.toLocaleTimeString();

      let row = `<tr>
        <td>${index++}</td>
        <td>${s.name}</td>
        <td>${s.regno}</td>
        <td>${s.dept}</td>
        <td>${s.stop}</td>
        <td>${date}</td>
        <td>${time}</td>
      </tr>`;

      table.innerHTML += row;
    });
  });
}

/* ================= LOGOUT ================= */
window.logout = async function () {
var bus = localStorage.getItem("bus");

if (bus) {
await setDoc(doc(db, "buses", bus), { active: false }, { merge: true });
}

localStorage.removeItem("adminSession");
window.location.href = "index.html";
};

/* ================= DISTANCE ================= */
function getDistance(lat1, lon1, lat2, lon2) {
var R = 6371;
var dLat = (lat2 - lat1) * Math.PI / 180;
var dLon = (lon2 - lon1) * Math.PI / 180;

var a =
Math.sin(dLat / 2) * Math.sin(dLat / 2) +
Math.cos(lat1 * Math.PI / 180) *
Math.cos(lat2 * Math.PI / 180) *
Math.sin(dLon / 2) *
Math.sin(dLon / 2);

return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

window.downloadData = function () {
  var table = document.querySelector("table");
  var rows = table.querySelectorAll("tr");

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
  a.download = "attendance.csv";
  a.click();
};

window.downloadPDF = function () {
  const { jsPDF } = window.jspdf;
  let doc = new jsPDF();

// get current bus
let bus = localStorage.getItem("bus") || "Unknown Bus";

// optional: convert to nice name
let busMap = {
  bus1: "Bus 1",
  bus2: "Bus 2",
  bus3: "Bus 3"
};

let busName = busMap[bus] || bus;

// set title
doc.text(`${busName} Attendance Report - ${today}`, 14, 10);

  doc.autoTable({
    html: "table",
    startY: 20
  });

  doc.save("attendance.pdf");
};

window.printTable = function () {
  var content = document.querySelector(".table-container").innerHTML;
  var win = window.open("", "", "width=900,height=650");

  win.document.write("<html><head><title>Print</title></head><body>");
  win.document.write(content);
  win.document.write("</body></html>");

  win.document.close();
  win.print();
};