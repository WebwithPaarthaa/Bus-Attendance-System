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

/* ================= SESSION ================= */
function getSession() {
  try {
    let s = localStorage.getItem("adminSession");
    return s ? JSON.parse(s) : null;
  } catch {
    return null;
  }
}

function isSessionValid(session) {
  if (!session) return false;
  const ONE_HOUR = 60 * 60 * 1000;
  return session.time && session.bus && (Date.now() - session.time < ONE_HOUR);
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

  /* DASHBOARD PROTECTION */
  if (path.includes("dashboard.html")) {

    if (!isSessionValid(session)) {
      localStorage.removeItem("adminSession");
      alert("Session expired. Login again.");
      window.location.href = "admin.html";
    } else {

      localStorage.setItem("bus", session.bus);
      startBusTracking();
    }
  }

  /* LOCATION CACHE */
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

  let adminRef = doc(db, "busAdmins", bus);
  let snap = await getDoc(adminRef);

  if (snap.exists()) {
    let data = snap.data();
    let last = new Date(data.loginTime);
    let diff = Date.now() - last.getTime();

    if (data.active && diff < 60 * 60 * 1000) {
      alert("Another admin is already logged in for this bus!");
      return;
    }
  }

  try {
    await signInWithEmailAndPassword(auth, email, password);

    await setDoc(adminRef, {
      active: true,
      bus: bus,
      loginTime: new Date().toISOString()
    });

    localStorage.setItem("adminSession", JSON.stringify({
      bus: bus,
      time: Date.now()
    }));

    /* HEARTBEAT */
    setInterval(async () => {
      let session = getSession();
      if (!session) return;

      await setDoc(doc(db, "busAdmins", session.bus), {
        active: true,
        loginTime: new Date().toISOString()
      }, { merge: true });

    }, 30000);

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

      alert("Attendance marked!!");
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
    await setDoc(doc(db, "busAdmins", bus), { active: false }, { merge: true });
  }

  if (busWatchId !== null) {
    navigator.geolocation.clearWatch(busWatchId);
  }

  localStorage.removeItem("adminSession");
  localStorage.removeItem("bus");

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

/* ================= MANAGER SECURITY ================= */
if (window.location.pathname.includes("manager")) {
  let email = prompt("Enter Manager Email:");

  if (email !== "parthak200701@gmail.com") {
    alert("Access denied");
    window.location.href = "index.html";
  }
}

/* ================= DATE ================= */
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